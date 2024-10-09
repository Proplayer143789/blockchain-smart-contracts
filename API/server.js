const express = require('express');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());

const CONTRACT_ADDRESS = '5DYqPGsJrvgB7dRM4ej6jpfXP5YPeHp8eBZZStvgQf2t4Xef'; // Esto se cambia al prender el servidor
const CONTRACT_ABI_PATH = path.resolve(__dirname, '../target/ink/smart_contract/smart_contract.json');

let api;
let contract;

async function init() {
    const wsProvider = new WsProvider('ws://localhost:9944');
    api = await ApiPromise.create({ provider: wsProvider });

    // Cargar el ABI del contrato
    let contractAbi;
    try {
        contractAbi = JSON.parse(fs.readFileSync(CONTRACT_ABI_PATH, 'utf8'));
    } catch (error) {
        console.error(`Error loading contract ABI: ${error.message}`);
        process.exit(1);
    }

    contract = new ContractPromise(api, contractAbi, CONTRACT_ADDRESS);
}
app.get('/user_exists_alice', async (req, res) => {
    const aliceAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

    try {
        const { output } = await contract.query.userExists(aliceAddress, { value: 0, gasLimit: -1 }, aliceAddress);
        if (output !== null) {
            res.send(output.toString());
        } else {
            res.status(404).send('Alice not found');
        }
    } catch (error) {
        res.status(500).send(`Error fetching Alice existence: ${error.message}`);
    }
});
app.get('/user_exists/:accountId', async (req, res) => {
    const { accountId } = req.params;
    try {
        const { output } = await contract.query.userExists(accountId, { value: 0, gasLimit: -1 }, accountId);
        if (output !== null) {
            res.send(output.toString());
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        res.status(500).send(`Error fetching user existence: ${error.message}`);
    }
});

app.post('/assign_role', async (req, res) => {
    const { accountId, role, userInfo } = req.body;
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    try {
        const txHash = await api.tx.smartContracts
            .assignRole(accountId, role, userInfo)
            .signAndSend(alice);

        res.send(`Transaction hash: ${txHash}`);
    } catch (error) {
        res.status(500).send(`Error assigning role: ${error.message}`);
    }
});

app.post('/request_access', async (req, res) => {
    const { doctorId, patientId } = req.body;
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    try {
        const txHash = await api.tx.smartContracts
            .requestAccess(doctorId, patientId)
            .signAndSend(alice);

        res.send(`Transaction hash: ${txHash}`);
    } catch (error) {
        res.status(500).send(`Error requesting access: ${error.message}`);
    }
});

app.post('/approve_access', async (req, res) => {
    const { patientId, doctorId, approve } = req.body;
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    try {
        const txHash = await api.tx.smartContracts
            .approveAccess(patientId, doctorId, approve)
            .signAndSend(alice);

        res.send(`Transaction hash: ${txHash}`);
    } catch (error) {
        res.status(500).send(`Error approving access: ${error.message}`);
    }
});

// Nuevo endpoint para obtener información de un bloque específico
app.get('/block/:blockNumber', async (req, res) => {
    const { blockNumber } = req.params;
    try {
        const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
        const block = await api.rpc.chain.getBlock(blockHash);
        res.json(block.toHuman());
    } catch (error) {
        res.status(500).send(`Error fetching block: ${error.message}`);
    }
});

// Inicializar la conexión y luego iniciar el servidor
init().then(() => {
    app.listen(port, () => {
        console.log(`API listening at http://localhost:${port}`);
    });
}).catch((error) => {
    console.error(`Failed to initialize API: ${error.message}`);
});