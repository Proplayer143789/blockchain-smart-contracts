const express = require('express');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const { mnemonicGenerate } = require('@polkadot/util-crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());

const CONTRACT_ADDRESS = '5FVr1aLwr5addVSptg9FdFE8akRcVBGv9NEchF5onRzLBGHr';
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

    // Suscribirse a los eventos
    api.query.system.events((events) => {
        console.log(`\nReceived ${events.length} events:`);

        // Loop through the Vec<EventRecord>
        events.forEach((record) => {
            try {
                // Extract the phase, event and the event types
                const { event, phase } = record;
                const types = event.typeDef;

                // Show what we are busy with
                console.log(`\t${event.section}:${event.method}:: (phase=${JSON.stringify(phase)})`);

                if (event.meta && event.meta.documentation) {
                    console.log(`\t\t${event.meta.documentation.toString()}`);
                }

                // Loop through each of the parameters, displaying the type and data
                event.data.forEach((data, index) => {
                    try {
                        const type = types[index] ? types[index].type : 'undefined';
                        const value = data ? data.toString() : 'undefined';
                        console.log(`\t\t\t${type}: ${value}`);
                    } catch (innerError) {
                        console.error(`Error processing event data: ${innerError.message}`);
                    }
                });
            } catch (error) {
                console.error(`Error processing event: ${error.message}`);
            }
        });
    });
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

async function transferFunds(sender, recipient, amount) {
    const transfer = api.tx.balances.transferAllowDeath(recipient, amount);
    return new Promise((resolve, reject) => {
        transfer.signAndSend(sender, (result) => {
            if (result.status.isInBlock || result.status.isFinalized) {
                resolve(result);
            } else if (result.isError) {
                reject(result);
            }
        });
    });
}

async function addUser(alice, newAccount, userInfo, role, gasLimit) {
    console.log(`Attempting to add user: ${JSON.stringify(userInfo)}`);
    const addUserTx = contract.tx.addUser({ value: 0, gasLimit }, newAccount.address, userInfo,role);
    return new Promise((resolve, reject) => {
        addUserTx.signAndSend(alice, ({ events = [], status }) => {
            if (status.isInBlock) {
                console.log(`Transaction included at blockHash ${status.asInBlock}`);
                events.forEach(({ event: { data, method, section } }) => {
                    if (section === 'system' && method === 'ExtrinsicFailed') {
                        const [dispatchError] = data;
                        if (dispatchError.isModule) {
                            const decoded = api.registry.findMetaError(dispatchError.asModule);
                            console.error(`Error: ${decoded.section}.${decoded.name}`);
                        } else {
                            console.error(`Error: ${dispatchError.toString()}`);
                        }
                    }
                });
            } else if (status.isFinalized) {
                console.log(`Transaction finalized at blockHash ${status.asFinalized}`);
                resolve(status);
            }
        }).catch(error => {
            console.error(`Transaction failed: ${error}`);
            reject(error);
        });
    });
}

async function assignRole(alice, newAccount, role, userInfo, gasLimit) {
    console.log(`Attempting to assign role ${role} to user: ${JSON.stringify(userInfo)}`);
    const assignRoleTx = contract.tx.assignRole({ value: 0, gasLimit }, newAccount.address, role, userInfo);
    return new Promise((resolve, reject) => {
        assignRoleTx.signAndSend(alice, (result) => {
            if (result.status.isInBlock) {
                console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
            } else if (result.status.isFinalized) {
                console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
                resolve(result);
            } else if (result.isError) {
                console.error(`Transaction error: ${result.toHuman()}`);
                reject(result);
            }
        });
    });
}

// Ruta para obtener las cuentas asociadas a un dni - Falta implementar en servidor
app.get('/get_accounts/:dni', async (req, res) => {
    const { dni } = req.params;

    try {
        console.log(`Attempting to fetch accounts for DNI: ${dni}`);

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        console.log('Querying contract...');
        const { result, output } = await contract.query.getAccounts(api.createType('AccountId', CONTRACT_ADDRESS), { value: 0, gasLimit }, dni);

        console.log('Query result:', result.toHuman());
        console.log('Query output:', output ? output.toHuman() : 'No output');

        if (result.isOk) {
            if (output) {
                const accounts = output.toJSON();
                console.log('Parsed accounts:', accounts);
                
                if (accounts && accounts.ok && Array.isArray(accounts.ok) && accounts.ok.length > 0) {
                    console.log(`Found ${accounts.ok.length} accounts for DNI ${dni}`);
                    res.json(accounts.ok);
                } else {
                    console.log(`No accounts found for DNI ${dni}`);
                    res.status(404).send(`No accounts found for dni ${dni}`);
                }
            } else {
                console.log('Query successful but no output returned');
                res.status(404).send(`No accounts found for dni ${dni}`);
            }
        } else {
            console.error('Contract call failed:', result.asErr.toHuman());
            res.status(500).send('Error fetching accounts: Contract call failed');
        }
    } catch (error) {
        console.error(`Error fetching accounts for dni ${dni}:`, error);
        res.status(500).send(`Error fetching accounts: ${error.message}`);
    }
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

        // Transferir fondos a la nueva cuenta usando transferAllowDeath
        await transferFunds(alice, newAccount.address, 1000000000000);

        // Esperar un poco para asegurarse de que la transferencia se haya completado
        await new Promise(resolve => setTimeout(resolve, 6000));

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        // Añadir el usuario y su información
        await addUser(alice, newAccount, userInfo, role, gasLimit);

        // Si la adición del usuario fue exitosa, agregar el rol
        //await assignRole(alice, newAccount, role, gasLimit);

        res.send(`User and role added successfully`);
    } catch (error) {
        res.status(500).send(`Error assigning role: ${error.message}`);
    }
});

app.post('/create_user_based_on_personalized_mnemonic', async (req, res) => {
    const { address, name, lastname, dni, email, role } = req.body;
    const newAccount = createNewAccount(address); // Genera una nueva cuenta

    const userInfo = {
        name: name,
        lastname: lastname,
        dni: dni,
        email: email
    };

    try {
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice'); // Usar la cuenta de Alice para firmar la transacción

        // Transferir fondos a la nueva cuenta usando transferAllowDeath
        await transferFunds(alice, newAccount.address, 1000000000000);

        // Esperar un poco para asegurarse de que la transferencia se haya completado
        await new Promise(resolve => setTimeout(resolve, 6000));

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        // Añadir el usuario y su información
        await addUser(alice, newAccount, userInfo, role, gasLimit);

        // Si la adición del usuario fue exitosa, agregar el rol
        //await assignRole(alice, newAccount, role, gasLimit);

        res.send(`User and role added successfully`);
    } catch (error) {
        res.status(500).send(`Error assigning role: ${error.message}`);
    }
});

app.post('/create_user_with_existing_address', async (req, res) => {
    const { address, name, lastname, dni, email, role } = req.body;

    // Verify that the provided address is valid
    const keyring = new Keyring({ type: 'sr25519' });
    let userAddress;
    try {
        userAddress = keyring.encodeAddress(address);
    } catch (error) {
        return res.status(400).send('Invalid address provided');
    }

    const userInfo = {
        name: name,
        lastname: lastname,
        dni: dni,
        email: email
    };

    try {
        const alice = keyring.addFromUri('//Alice'); // Use Alice's account to sign the transaction

        // Transfer funds to the user's address
        await transferFunds(alice, userAddress, 1000000000000);

        // Wait a bit to ensure the transfer has been completed
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Set up the gas limit
        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        // Add the user and their information to the contract
        await addUser(alice, userAddress, userInfo, role, gasLimit);

        res.status(200).send(`User created with address ${userAddress}`);
    } catch (error) {
        console.error(`Error creating user with address ${userAddress}: ${error}`);
        res.status(500).send(`Error creating user: ${error.message}`);
    }
});

app.get('/role/:publicAddress', async (req, res) => {
    const { publicAddress } = req.params;

    try {
        const keyring = new Keyring({ type: 'sr25519' });
        let accountId;
        try {
            accountId = keyring.decodeAddress(publicAddress);
        } catch (e) {
            console.error("Failed to decode address:", e);
            return res.status(400).send(`Invalid public address: ${publicAddress}`);
        }

        console.log("Decoded Account ID:", accountId);

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });// Ajusta si es necesario.
        const { output } = await contract.query.getRole(accountId, { value: 0, gasLimit }, accountId);

        console.log("Contract query response:", output ? output.toHuman() : "No output");

        if (!output || output.isNone) {
            return res.status(404).send(`Role not found for account ${publicAddress}`);
        }

        // Verifica si output tiene la propiedad value y maneja Option<u8>
        if (output && output.value !== undefined) {
            const role = output.value !== null ? output.value.toString() : 'None';
            res.send(`Role for account ${publicAddress}: ${role}`);
        } else {
            res.status(500).send('Error fetching role: Invalid output format');
        }
    } catch (error) {
        console.error("Error fetching role:", error);
        res.status(500).send(`Error fetching role: ${error.message}`);
    }
});


app.get('/alice_account_id', async (req, res) => {
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//');
    res.send(`Alice's account: ${alice.address}`);
});

init().then(() => {
    app.listen(port, () => {
        console.log(`API listening at http://localhost:${port}`);
    });
}).catch((error) => {
    console.error(`Failed to initialize API: ${error.message}`);
});