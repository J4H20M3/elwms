import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const log = console.log;
const error = console.error;

var db = null;

onmessage = function ({ data }) {
  const { action } = data;
  switch (action) {
    case 'createDB': {
      const { name } = data;
      createDatabase(name)
        .then(({ instance, message }) => {
          db = instance;
          postMessage({ type: 'created', message });
        });
      break;
    }
    case 'executeQuery': {
      const { sql } = data;
      log(sql);
      const result = db.exec({ sql, returnValue: "resultRows" });
      postMessage({ result, type: "application/json" });
      break;
    }
    case 'uploadDB':
      try {
        const { name, arrayBuffer } = data;
        uploadDatabase(name, arrayBuffer)
          .then(({ instance, message }) => {
            db = instance;
            log("uploadDB message", message);
            log("uploadDB", instance);
          });
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
    default:
      log(data)
  }
}

function createDatabase(name) {
  return sqlite3InitModule({ print: log, printErr: error })
    .then(sqlite3 => 'opfs' in sqlite3
      ? { instance: new sqlite3.oo1.OpfsDb(`/${name}.sqlite3`), message: `OPFS is available, created persisted database at /${name}.sqlite3` }
      : { instance: new sqlite3.oo1.DB(`/${name}.sqlite3`, 'ct'), message: `OPFS is not available, created transient database /${name}.sqlite3` })
    .catch(err => {
      error(err.name, err.message);
    })
}

function uploadDatabase(name, arrayBuffer) {
  return sqlite3InitModule({ print: log, printErr: error })
    .then(sqlite3 => {
      if ('opfs' in sqlite3) {
        return { instance: new sqlite3.oo1.OpfsDb(`/${name}.sqlite3`), message: `OPFS is available, created persisted database at /${name}.sqlite3`, message: `New DB imported as ${name}.sqlite3. (${arrayBuffer.byteLength} Bytes)` }
      } else {
        throw new Error("unsupported");
      }
    })
    .catch(err => {
      error(err.name, err.message);
    })
}
