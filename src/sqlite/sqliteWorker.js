import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const log = console.log;
const error = console.error;

var instance = null;

onmessage = async function ({ data }) {
  const { action } = data;
  switch (action) {
    case 'createDB': {
      const { name } = data;
      const { db, message } = await createDatabase(name);
      instance = db;
      log(message);
      break;
    }
    case 'uploadDB':
      try {
        const { name, arrayBuffer } = data;
        const { db, message } = await uploadDatabase(name, arrayBuffer);
        instance = db;
        log(message);
      } catch (e) {
        error(e);
      }
      break;
    case 'downloadDB':
      try {
        const byteArray = sqlite3.capi.sqlite3_js_db_export(db);
        const blob = new Blob([byteArray.buffer], { type: "application/vnd.sqlite3" });
        postMessage(blob); // send the database Blob to the API
      } catch (e) {
        if (e.message.indexOf("SQLITE_NOMEM") != -1)
          postMessage({ type: "application/vnd.sqlite3", error: "SQLITE_NOMEM" });
        else
          error(e);
      }
      break;
    case 'executeQuery': {
      const { sql, returnValue } = data;
      log(sql);
      const db = await getInstance(1);
      const result = await db.exec({ sql, returnValue });
      postMessage({ timestamp: data.timestamp, result: this.structuredClone(result), type: "application/json" });
      break;
    }
    default:
      log(data)
  }
}

function getInstance(tries) {
  return new Promise((resolve, reject) => {
    const checkAgain = function (tries) {
      let tryCount = 0;
      if (instance) {
        resolve(instance);
      } else {
        if (tries > tryCount++) {
          setTimeout(checkAgain, 0)
        } else {
          reject(new Error("not working"));
        }
      }
    }
    checkAgain();
  });
}

async function createDatabase(name) {
  return sqlite3InitModule({ print: log, printErr: error })
    .then(sqlite3 => 'opfs' in sqlite3
      ? { db: new sqlite3.oo1.OpfsDb(`/${name}.sqlite3`), message: `OPFS is available, created persisted database at /${name}.sqlite3` }
      : { db: new sqlite3.oo1.DB(`/${name}.sqlite3`, 'ct'), message: `OPFS is not available, created transient database /${name}.sqlite3` })
    .catch(err => {
      error(err.name, err.message);
    })
}

async function uploadDatabase(name, arrayBuffer) {
  return sqlite3InitModule({ print: log, printErr: error })
    .then(sqlite3 => {
      if ('opfs' in sqlite3) {
        return { db: new sqlite3.oo1.OpfsDb(`/${name}.sqlite3`), message: `OPFS is available, created persisted database at /${name}.sqlite3`, message: `New DB imported as ${name}.sqlite3. (${arrayBuffer.byteLength} Bytes)` }
      } else {
        throw new Error("unsupported");
      }
    })
    .catch(err => {
      error(err.name, err.message);
    })
}
