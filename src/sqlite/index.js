import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

// https://www.npmjs.com/package/@sqlite.org/sqlite-wasm
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

const log = console.log;
const error = console.error;

const workers = {};
let publicAPI = {};
let returnValues = {}; // return values go here

function initalizeWorker(name) {
    let worker = new Worker(new URL('./sqliteWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = function ({ data }) {
        const { type } = data;
        switch (type) {
            case "application/vnd.sqlite3": { // db download ready 
                let downloadChannel = new BroadcastChannel("download_channel");
                downloadChannel.postMessage(data);
                downloadChannel.close();
                break;
            }
            case "application/json":
                const { timestamp, result } = data;
                returnValues[timestamp] = structuredClone(result);
                break;
            default:
                const { message } = data;
                log("Response from worker: ", message);
        }
    }
    if (workers[name]) {
        error("InstantiationError: already taken");
        worker.terminate();
    } else {
        workers[name] = worker;
    }
}

const api = {
    createDB: async function (name) {
        initalizeWorker(name);
        let worker = this.getWorker(name);
        worker.postMessage({ action: 'createDB', name });
    },
    getWorker: function (name) {
        let worker = workers[name];
        return worker ? worker : undefined;
    },
    downloadDB: function (name) {
        let worker = workers[name];
        if (worker) {
            worker.postMessage({ action: 'downloadDB' });
        }
    },
    uploadDB: function (fileName, arrayBuffer) {
        let [name, extension] = fileName.split(".");
        if (extension === 'sqlite3') {
            worker = workers[name];
            if (!worker) {
                initalizeWorker(name);
                worker.postMessage({ action: 'uploadDB', name, arrayBuffer });
            } // TODO: allow overwrite
        } else {
            error("unsupported file type");
        }
    }
}

if (window.Worker) {
    try {
        const sqlite3 = await sqlite3InitModule({ print: log, printErr: error });
        log('Running SQLite3 version', sqlite3.version.libVersion);
        publicAPI = api;
    } catch (err) {
        error('Initialization error:', err.name, err.message);
    }
} else {
    console.error('Your browser doesn\'t support web workers.');
}

export async function executeQuery({ text, values }) {
    let queryString = text;
    if (values && queryString.indexOf("$") != -1) values.forEach(function replacePlaceholder(item, index) { queryString = queryString.replace("$" + (index + 1), `'${item}'`); });
    const worker = await getWorker();
    let timestamp = Date.now();
    worker.postMessage({ timestamp, type: "exec", sql: queryString, returnValue: "resultRows" });
    try {
        return new Promise((resolve) => {
            const checkAgain = function () {
                if (returnValues[timestamp]) {
                    const returnValue = structuredClone(returnValues[timestamp]);
                    resolve(returnValue);
                } else
                    setTimeout(checkAgain, 0);
            }
            checkAgain();
        });
    } finally {
        delete returnValues[timestamp];
    }
}

export async function executeQuerySync({ text, values }) {
    let queryString = text;
    if (values && queryString.indexOf("$") === -1) values.forEach(function replacePlaceholder(item, index) { queryString = queryString.replace("$" + (index + 1), `'${item}'`); });
    const message = { type: "exec", sql: queryString, returnValue: "resultRows" };
    const worker = await getWorker();
    worker.postMessage(JSON.stringify(message));
}

export default publicAPI;