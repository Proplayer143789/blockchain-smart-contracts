// logging_middleware.js

const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

// Rutas para los archivos de logs
const LOG_FILE_PATH = path.join(__dirname, 'performance_log.txt');
const logFileJsonPath = path.join(__dirname, 'performance_log.json');
let fileExists = fs.existsSync(logFileJsonPath);
const test_type = process.env.TEST_TYPE || 'sequential';

// Función para obtener el uso de sistema actual (CPU y RAM)
function getSystemUsage() {
    const cpuUsage = os.loadavg()[0]; // Promedio de carga de 1 minuto
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;

    return { cpuUsage, memUsage };
}

// Función para calcular la longitud total de los parámetros
function getParamsLength(req) {
    let length = 0;

    // Longitud de parámetros del cuerpo (body)
    if (req.body && typeof req.body === 'object') {
        length += JSON.stringify(req.body).length;
    }

    return length;
}

// Middleware para medir la duración de la solicitud y registrar logs en formato txt
function logRequestToTxt(req, res, next) {
    const startTime = Date.now();
    const { cpuUsage: startCpu, memUsage: startMem } = getSystemUsage();
    const paramsLength = getParamsLength(req);

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const { cpuUsage: endCpu, memUsage: endMem } = getSystemUsage();
        const groupID = req.body.groupID || 'N/A'; // Obtener el groupID de la solicitud
        const totalTransactions = req.body.totalTransactions || 'N/A'; // Obtener totalTransactions de la solicitud

        const logEntry = `
        Time: ${new Date().toISOString()}
        Request Number: ${res.locals.transactionCount}
        GroupID: ${groupID}
        Total Transactions: ${totalTransactions}
        Route: ${req.method} ${req.originalUrl}
        Method: ${req.method}
        RefTime (Gas Computacional): ${res.locals.refTime || 'N/A'}
        ProofSize: ${res.locals.proofSize || 'N/A'}
        Tip: ${res.locals.tip || 'N/A'}
        Duration: ${duration} ms
        CPU Usage (start): ${startCpu.toFixed(2)}%
        CPU Usage (end): ${endCpu.toFixed(2)}%
        RAM Usage (start): ${startMem.toFixed(2)}%
        RAM Usage (end): ${endMem.toFixed(2)}%
        Transaction Success: ${res.locals.transactionSuccess ? 'Yes' : 'No'}
        Parameters Length: ${paramsLength}
        Test Type: ${test_type}
        ---
        `;

        // Escribir el log en archivo txt
        fs.appendFile(LOG_FILE_PATH, logEntry, (err) => {
            if (err) throw new Error(`Error al escribir en el log: ${err.message}`);
        });
    });

    next();
}

// Middleware para medir la duración de la solicitud y registrar logs en formato JSON
function logRequestToJson(req, res, next) {
    const startTime = Date.now();
    const { cpuUsage: startCpu, memUsage: startMem } = getSystemUsage();
    const paramsLength = getParamsLength(req);

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const { cpuUsage: endCpu, memUsage: endMem } = getSystemUsage();
        const groupID = req.body.groupID || 'N/A'; // Obtener el groupID de la solicitud
        const totalTransactions = req.body.totalTransactions || 'N/A'; // Obtener totalTransactions de la solicitud

        const logEntry = {
            time: new Date().toISOString(),
            requestNumber: res.locals.transactionCount,
            groupID: groupID,
            totalTransactions: totalTransactions,
            route: `${req.method} ${req.originalUrl}`,
            method: req.method,
            refTime: res.locals.refTime || 'N/A',
            proofSize: res.locals.proofSize || 'N/A',
            tip: res.locals.tip || 'N/A',
            duration: `${duration} ms`,
            cpuUsageStart: `${startCpu.toFixed(2)}%`,
            cpuUsageEnd: `${endCpu.toFixed(2)}%`,
            ramUsageStart: `${startMem.toFixed(2)}%`,
            ramUsageEnd: `${endMem.toFixed(2)}%`,
            transactionSuccess: res.locals.transactionSuccess ? 'Yes' : 'No',
            parametersLength: paramsLength,
            testType: test_type
        };

        const logEntryString = JSON.stringify(logEntry);

        if (!fileExists) {
            try {
                const initialContent = `[${logEntryString}]`;
                fs.writeFileSync(logFileJsonPath, initialContent);
                fileExists = true;
            } catch (err) {
                console.error(`Error al crear el archivo de log JSON: ${err.message}`);
            }
        } else {
            try {
                fs.readFile(logFileJsonPath, 'utf8', (err, data) => {
                    if (err) return console.error(`Error al leer el archivo de log JSON: ${err.message}`);

                    let newData = data.trim();

                    if (newData.length === 0 || newData === '[]') {
                        newData = `[${logEntryString}]`;
                    } else {
                        newData = newData.slice(0, -1);
                        newData += `,${logEntryString}]`;
                    }

                    fs.writeFile(logFileJsonPath, newData, (err) => {
                        if (err) return console.error(`Error al escribir en el archivo de log JSON: ${err.message}`);
                    });
                });
            } catch (err) {
                console.error(`Error al actualizar el archivo de log JSON: ${err.message}`);
            }
        }
    });

    next();
}

module.exports = {
    logRequestToTxt,
    logRequestToJson,
    getSystemUsage
};
