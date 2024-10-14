const express = require('express');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const { mnemonicGenerate } = require('@polkadot/util-crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());

const CONTRACT_ADDRESS = '5DYqPGsJrvgB7dRM4ej6jpfXP5YPeHp8eBZZStvgQf2t4Xef';
const CONTRACT_ABI_PATH = path.resolve(__dirname, '../target/ink/smart_contract/smart_contract.json');

let api;
let contract;

async function init() {
    const wsProvider = new WsProvider('ws://localhost:9944');
    api = await ApiPromise.create({ provider: wsProvider });

    let contractAbi;
    try {
        contractAbi = JSON.parse(fs.readFileSync(CONTRACT_ABI_PATH, 'utf8'));
    } catch (error) {
        console.error(`Error loading contract ABI: ${error.message}`);
        process.exit(1);
    }

    contract = new ContractPromise(api, contractAbi, CONTRACT_ADDRESS);
}

function createNewAccount(customText = null) {
    const keyring = new Keyring({ type: 'sr25519' });
    const mnemonic = customText || mnemonicGenerate();
    const newAccount = keyring.addFromUri(mnemonic);
    console.log(`New account created: ${newAccount.address}`);
    console.log(`Mnemonic: ${mnemonic}`);
    return {
        address: newAccount.address,
        mnemonic: mnemonic,
        keypair: newAccount
    };
}

app.get('/new_account', (req, res) => {
    const newAccount = createNewAccount();
    res.json(newAccount);
});

app.post('/create_user', async (req, res) => {
    const { name, lastname, dni, email, role } = req.body;
    const newAccount = createNewAccount(); // Genera una nueva cuenta

    const userInfo = {
        name: name,
        lastname: lastname,
        dni: dni,
        email: email
    };

    try {
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice'); // Usar la cuenta de Alice para firmar la transacción

        // Transferir fondos a la nueva cuenta
        const transfer = api.tx.balances.transferAllowDeath(newAccount.address, 1000000000000);
        await transfer.signAndSend(alice);

        // Esperar un poco para asegurarse de que la transferencia se haya completado
        await new Promise(resolve => setTimeout(resolve, 6000));

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 1000000000),
            proofSize: api.registry.createType('Compact<u64>', 1000000)
        });

        // Añadir el usuario y su información
        const addUserTx = contract.tx.addUser({ value: 0, gasLimit }, newAccount.address, userInfo);
        await new Promise((resolve, reject) => {
            addUserTx.signAndSend(alice, (result) => {
                if (result.status.isInBlock || result.status.isFinalized) {
                    resolve(result);
                } else if (result.isError) {
                    reject(result);
                }
            });
        });

        // Si la adición del usuario fue exitosa, agregar el rol
        const assignRoleTx = contract.tx.assignRole({ value: 0, gasLimit }, newAccount.address, role, userInfo);
        await new Promise((resolve, reject) => {
            assignRoleTx.signAndSend(alice, (result) => {
                if (result.status.isInBlock || result.status.isFinalized) {
                    resolve(result);
                } else if (result.isError) {
                    reject(result);
                }
            });
        });

        res.send(`User and role added successfully`);
    } catch (error) {
        res.status(500).send(`Error assigning role: ${error.message}`);
    }
});

app.get('/role/:publicAddress', async (req, res) => {
    const { publicAddress } = req.params;

    try {
        const keyring = new Keyring({ type: 'sr25519' });
        const accountId = keyring.decodeAddress(publicAddress);
        console.log("accountId", accountId);
        const { output } = await contract.query.getRole(accountId, {
            value: 0,
            gasLimit: -1
        }, accountId);
        console.log("output", output);
        if (!output || output.isNone) {
            res.status(404).send(`Role not found for account ${publicAddress}`);
        } else {
            const role = output.unwrap().toString();
            res.send(`Role for account ${publicAddress}: ${role}`);
        }
    } catch (error) {
        res.status(500).send(`Error fetching role: ${error.message}`);
    }
});

app.get('/alice_account_id', async (req, res) => {
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    res.send(`Alice's accountId: ${alice.address}`);
});

init().then(() => {
    app.listen(port, () => {
        console.log(`API listening at http://localhost:${port}`);
    });
}).catch((error) => {
    console.error(`Failed to initialize API: ${error.message}`);
});