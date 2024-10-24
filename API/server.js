const express = require('express');
const cors = require('cors');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { ContractPromise } = require('@polkadot/api-contract');
const { mnemonicGenerate } = require('@polkadot/util-crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();
const { logRequestToTxt, logRequestToJson } = require('./logging_middleware');

const { getTip } = require('./tip_manager');

const app = express();
const port = 3000;

// Configuración del CORS
const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || '*', 
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Contract Dirección y ABI
const CONTRACT_ADDRESS = '5DYT7X58LFq24ttfNZbcgX4vwP8DGjP6Zy6RKQaXMchkMh9z';
const CONTRACT_ABI_PATH = path.resolve(__dirname, '../target/ink/smart_contract/smart_contract.json');

// Performance monitoring configuration
const ENABLE_PERFORMANCE_MONITORING = process.env.ENABLE_PERFORMANCE_MONITORING === 'true';
const LOG_FILE_PATH = path.join(__dirname, 'performance_log.txt');
const logFileJsonPath = path.join(__dirname, 'performance_log.json');
let fileExists = fs.existsSync(logFileJsonPath);
const total_request = process.env.TOTAL_REQUESTS || "100";
const test_type = process.env.TEST_TYPE || 'sequential';

// Middlewares para registrar logs en formato txt y json
app.use(logRequestToTxt);
app.use(logRequestToJson);


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

let transactionCount = 0; // Contador global de transacciones
let lastTransactionTime = Date.now(); // Tiempo de la última transacción
const resetInterval = 5000; // Intervalo de 5 segundos para reiniciar el contador

// Función para actualizar el contador de transacciones y reiniciarlo si pasan 5s
function updateTransactionCount() {
    const currentTime = Date.now();
    
    // Si ha pasado más de 5 segundos desde la última transacción, reiniciamos el contador
    if (currentTime - lastTransactionTime > resetInterval) {
        transactionCount = 0;
    }

    // Incrementamos el contador
    transactionCount += 1;
    lastTransactionTime = currentTime; // Actualizamos el tiempo de la última transacción
}

// Contador inicial de transacciones pendientes
let pendingTransactions = parseInt(total_request); 
let tip = pendingTransactions; // Variable global para el tip, que comienza en el total de transacciones

// Función para manejar el tip: disminuye con cada transacción
function decrementTip() {
    if (tip > 0) {
        tip -= 1;
    }

    console.log(`Tip set to: ${tip}`);
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

// Función para transferir fondos con tip incluido usando transferKeepAlive
async function transferFunds(sender, recipient, amount) {
    decrementTip(); // Disminuye el tip antes de la transacción
    const transfer = api.tx.balances.transferKeepAlive(recipient, amount);

    return new Promise((resolve, reject) => {
        transfer.signAndSend(sender, { tip }, (result) => {
            if (result.status.isInBlock) {
                console.log(`Transferencia incluida en el bloque: ${result.status.asInBlock}`);
            }
            if (result.status.isFinalized) {
                console.log(`Transferencia finalizada en el bloque: ${result.status.asFinalized}`);
                resolve(result); // La transacción ha sido finalizada correctamente, continuar con las siguientes funciones
            }
            if (result.isError) {
                console.error('Error en la transferencia:', result);
                reject(new Error('Error en la transferencia.')); // Rechazar si hay un error
            }
        }).catch((error) => {
            reject(new Error(`Error en la transferencia: ${error.message}`)); // Capturar errores inesperados
        });
    });
}


// Modificar la función addUser para incluir el tip en la transacción
async function addUser(alice, newAccount, userInfo, role, gasLimit) {
    decrementTip(); // Disminuye el tip antes de la transacción
    const addUserTx = contract.tx.addUser({ value: 0, gasLimit }, newAccount.address, userInfo, role);
    return new Promise((resolve, reject) => {
        addUserTx.signAndSend(alice, { tip }, ({ events = [], status }) => {
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

// Modificar la función assignRole para incluir el tip en la transacción
async function assignRole(alice, newAccount, role, userInfo, gasLimit) {
    decrementTip(); // Disminuye el tip antes de la transacción
    const assignRoleTx = contract.tx.assignRole({ value: 0, gasLimit }, newAccount.address, role, userInfo);
    return new Promise((resolve, reject) => {
        assignRoleTx.signAndSend(alice, { tip }, (result) => {
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

// Ruta para obtener las cuentas asociadas a un dni
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

// Endpoint para crear un usuario
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

        // Transferir fondos a la nueva cuenta usando transferKeepAlive
        await transferFunds(alice, newAccount.address, 1000000000000);

        // Esperar un poco para asegurarse de que la transferencia se haya completado
        await new Promise(resolve => setTimeout(resolve, 6000));

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        // Añadir el usuario y su información
        await addUser(alice, newAccount, userInfo, role, gasLimit);

        // Si la adición del usuario fue exitosa, agregar el rol (si es necesario)
        // await assignRole(alice, newAccount, role, userInfo, gasLimit);

        res.status(200).send(`User and role added successfully`);
    } catch (error) {
        res.status(500).send(`Error assigning role: ${error.message}`);
    }
});

// Endpoint para crear un usuario basado en un mnemonic personalizado
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

        // Transferir fondos a la nueva cuenta usando transferKeepAlive
        await transferFunds(alice, newAccount.address, 1000000000000);

        // Esperar un poco para asegurarse de que la transferencia se haya completado
        await new Promise(resolve => setTimeout(resolve, 6000));

        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 10000000000),
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        // Añadir el usuario y su información
        await addUser(alice, newAccount, userInfo, role, gasLimit);

        // Si la adición del usuario fue exitosa, agregar el rol (si es necesario)
        // await assignRole(alice, newAccount, role, userInfo, gasLimit);

        res.status(200).send(`User and role added successfully`);
    } catch (error) {
        res.status(500).send(`Error assigning role: ${error.message}`);
    }
});

// Endpoint para crear un usuario con una dirección existente
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

        // Transfer funds to the user's address using transferKeepAlive
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

// Endpoint para obtener el rol de un usuario
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
        });
        const { output } = await contract.query.getRole(accountId, { value: 0, gasLimit }, accountId);

        console.log("Contract query response:", output ? output.toHuman() : "No output");

        if (!output || output.isNone) {
            return res.status(404).send(`Role not found for account ${publicAddress}`);
        }

        // Verifica si output tiene la propiedad value y maneja Option<u8>
        if (output && output.value !== undefined) {
            const role = output.value !== null ? output.value.toString() : 'None';
            res.status(200).send(`Role for account ${publicAddress}: ${role}`);
        } else {
            res.status(500).send('Error fetching role: Invalid output format');
        }
    } catch (error) {
        console.error("Error fetching role:", error);
        res.status(500).send(`Error fetching role: ${error.message}`);
    }
});

// Endpoint para obtener la dirección de Alice
app.get('/alice_account_id', async (req, res) => {
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    res.status(200).send(`Alice's account: ${alice.address}`);
});

// Función para ejecutar el contrato y obtener el gas consumido después de la ejecución
async function executeContractAndGetGas(contract, signer, res, ...params) {
    try {
        updateTransactionCount(); // Actualizar el contador de transacciones

        // Definir un límite de gas alto para asegurar la ejecución (sin estimación previa)
        const gasLimit = api.registry.createType('WeightV2', {
            refTime: api.registry.createType('Compact<u64>', 20000000000), // Ajusta este valor según lo necesario
            proofSize: api.registry.createType('Compact<u64>', 10000000)
        });

        // Inicializamos refTime fuera del contexto de los eventos
        let refTime = null;

        // Llamada directa al método addUser del contrato
        const tx = contract.tx.addUser(
            { value: 0, gasLimit }, // Asigna un gas límite alto
            ...params // Los parámetros del método
        );

        // Enviar la transacción y esperar a la finalización
        return new Promise((resolve, reject) => {
            tx.signAndSend(signer, (result) => {
                if (result.status.isFinalized) {
                    //console.log('Transacción finalizada en bloque:', result.status.asFinalized);

                    // Iterar sobre los eventos para encontrar el peso (gas) consumido
                    result.events.forEach(({ event: { data, method, section } }) => {
                        console.log(`Event: ${section}.${method} - ${JSON.stringify(data.toHuman())}`);

                        if (section === 'system' && method === 'ExtrinsicSuccess') {
                            // Obtener el gas computacional (refTime) del evento ExtrinsicSuccess
                            if (data && data.length > 0 && data[0].weight) {
                                refTime = data[0].weight.refTime;
                                console.log(`Gas (refTime) consumido: ${refTime}`);
                            }
                        }
                    });

                    // Guardar refTime y el estado de éxito en res.locals
                    res.locals.refTime = refTime || 'N/A'; // Si no se encuentra, asignar 'N/A'
                    res.locals.transactionSuccess = true; // Transacción exitosa
                    res.locals.transactionCount = transactionCount; // Guardamos el contador de la transacción

                    resolve({
                        blockHash: result.status.asFinalized.toString(),
                        gasUsed: refTime ? refTime.toHuman() : 'No se encontró el consumo de gas'
                    });
                } else if (result.isError) {
                    console.error('Error en la transacción:', result);

                    // Guardar el estado de fallo en res.locals
                    res.locals.transactionSuccess = false; // Transacción fallida
                    res.locals.refTime = 0; // Gas 0 cuando falla la transacción

                    reject(new Error('Error en la transacción.'));
                }
            });
        });

    } catch (error) {
        console.error(`Error al ejecutar la transacción: ${error.message}`);
        res.locals.transactionSuccess = false; // Transacción fallida
        res.locals.refTime = 0; // Gas 0 cuando falla la transacción
        throw error;
    }
}


app.post('/create_user_with_dynamic_gas', async (req, res) => {
    const { name, lastname, dni, email, role } = req.body;

    try {
        const keyring = new Keyring({ type: 'sr25519' });
        const alice = keyring.addFromUri('//Alice'); // Usar la cuenta de Alice para firmar la transacción

        const newAccount = createNewAccount(); // Genera una nueva cuenta

        const userInfo = {
            name: name,
            lastname: lastname,
            dni: dni,
            email: email
        };

        // Transferir fondos a la nueva cuenta y esperar hasta que la transacción sea finalizada
        await transferFunds(alice, newAccount.address, 1000000000000);

        // Ejecutar la transacción del contrato (addUser) y recuperar el gas consumido
        const result = await executeContractAndGetGas(contract, alice, res, newAccount.address, userInfo, role);

        // Responder con éxito
        res.status(200).json({
            message: 'Usuario creado con éxito',
            blockHash: result.blockHash,
            gasUsed: result.gasUsed,
            cpuUsageStart: res.locals.cpuUsageStart,
            cpuUsageEnd: res.locals.cpuUsageEnd,
            ramUsageStart: res.locals.ramUsageStart,
            ramUsageEnd: res.locals.ramUsageEnd
        });

    } catch (error) {
        console.error('Error al crear el usuario:', error);
        res.status(500).json({ error: `Error al crear el usuario: ${error.message}` });
    }
});





// Iniciar el servidor
init().then(() => {
    const host = process.env.HOST || '0.0.0.0';
    app.listen(port, host, () => {
      console.log(`API listening at http://${host}:${port}`);
      if (ENABLE_PERFORMANCE_MONITORING) {
        console.log(`Performance monitoring enabled. Logs will be written to ${LOG_FILE_PATH}`);
      }
    });
}).catch((error) => {
    console.error(`Failed to initialize API: ${error.message}`);
});
