import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

// https://www.npmjs.com/package/@sqlite.org/sqlite-wasm
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers

const log = console.log;
const error = console.error;

const workers = {};
let publicAPI = {};

const api = {
    getWorker: function (name = 'default') {
        let worker = workers[name];
        return worker ? worker : undefined;
    },
    createDB: function (name = 'default') {
        return new Promise((resolve, reject) => {
            initalizeWorker(name);
            let worker = this.getWorker(name);
            worker.onmessage = function ({ data }) {
                const { type, message } = data;
                if (type === 'created') {
                    resolve(message);
                }
            }
            worker.onerror = (error) => {
                reject(new Error(error));
            };
            worker.postMessage({ action: 'createDB', name });
        });
    },
    executeQuery: function ({ sql, values }) {
        return new Promise((resolve, reject) => {
            let worker = this.getWorker();
            worker.onmessage = function ({ data }) {
                const { type } = data;
                if (type === 'application/json') {
                    const { result } = data;
                    resolve(result);
                }
            }
            worker.onerror = (error) => {
                reject(error);
            };
            if (values && sql.indexOf("$") != -1) {
                values.forEach(
                    function replacePlaceholder(item, index) {
                        sql = sql.replace("$" + (index + 1), `'${item}'`);
                    }
                );
            }
            worker.postMessage({ action: "executeQuery", sql });
        })
    },
    downloadDB: function (name = 'default') {
        let worker = workers[name];
        if (worker) {
            worker.onmessage = function ({ data }) {
                const { type } = data;
                if (type === 'application/vnd.sqlite3') {
                    let downloadChannel = new BroadcastChannel("download_channel");
                    downloadChannel.postMessage(data);
                    downloadChannel.close();
                }
            }
            worker.postMessage({ action: 'downloadDB' });
        }
    },
    uploadDB: function (fileName, arrayBuffer) {
        let [name, extension] = fileName.split(".");
        if (extension === 'sqlite3') {
            let worker = workers[name];
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

function initalizeWorker(name) {
    let worker = new Worker(new URL('./sqliteWorker.js', import.meta.url), { type: 'module' });
    if (workers[name]) {
        error("InstantiationError: already taken");
        worker.terminate();
    } else {
        workers[name] = worker;
    }
}

export default publicAPI;