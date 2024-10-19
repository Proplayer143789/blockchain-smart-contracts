require('dotenv').config();  // Cargar las variables de entorno desde el archivo .env
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');  // Para generar identificadores únicos
const faker = require('faker'); // Para generar datos ficticios
const fs = require('fs');

// Cargar variables del archivo .env
const HOST = process.env.HOST === '0.0.0.0' ? 'localhost' : process.env.HOST; // Si es 0.0.0.0, usar localhost para las solicitudes
const PORT = process.env.PORT || 3000; // El puerto en el que corre el servidor
const TOTAL_REQUESTS = 100; // Cantidad de solicitudes totales
const SIMULTANEOUS_REQUESTS = 10; // Cantidad de solicitudes simultáneas por lote
const MODE = 'concurrent'; // Puede ser 'sequential', 'concurrent', o 'batch'

// URL completa de tu API (basada en HOST y PORT)
const FULL_URL = `http://${HOST}:${PORT}`;  // Construir correctamente el URL

// Función para generar datos aleatorios
function generateTestData() {
    return {
        name: faker.name.firstName(),
        lastname: faker.name.lastName(),
        dni: faker.datatype.number({ min: 10000000, max: 99999999 }).toString(),
        email: faker.internet.email(),
        role: faker.datatype.number({ min: 0, max: 1 })
    };
}

// Función para hacer una solicitud POST a /create_user
async function createUser(data) {
    try {
        const response = await axios.post(`${FULL_URL}/create_user`, data);
        return response.data;
    } catch (error) {
        console.error(`Error creating user: ${error.message}`);
    }
}

// Prueba secuencial (las solicitudes se realizan una por una)
async function runSequentialTest() {
    console.log(`Running sequential test with ${TOTAL_REQUESTS} requests...`);
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        const data = generateTestData();
        console.log(`Creating user ${i + 1}:`, data);
        await createUser(data);
    }
    console.log('Sequential test completed');
}

// Prueba concurrente (las solicitudes se ejecutan simultáneamente)
async function runConcurrentTest() {
    console.log(`Running concurrent test with ${TOTAL_REQUESTS} requests...`);
    const promises = [];
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        const data = generateTestData();
        promises.push(createUser(data));
    }
    await Promise.all(promises);
    console.log('Concurrent test completed');
}

// Prueba por lotes (ejecuta solicitudes en grupos)
async function runBatchTest(batchSize) {
    console.log(`Running batch test with ${TOTAL_REQUESTS} requests in batches of ${batchSize}...`);
    for (let i = 0; i < TOTAL_REQUESTS; i += batchSize) {
        const batchPromises = [];
        for (let j = 0; j < batchSize && i + j < TOTAL_REQUESTS; j++) {
            const data = generateTestData();
            batchPromises.push(createUser(data));
        }
        await Promise.all(batchPromises);
    }
    console.log('Batch test completed');
}

// Ejecuta la prueba seleccionada
(async () => {
    switch (MODE) {
        case 'sequential':
            await runSequentialTest();
            break;
        case 'concurrent':
            await runConcurrentTest();
            break;
        case 'batch':
            await runBatchTest(SIMULTANEOUS_REQUESTS);
            break;
        default:
            console.error('Invalid mode selected');
    }
})();
