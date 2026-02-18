import initSqlJs from "./vendor/sql-wasm.js";

const DEFAULT_DB_NAME = "context-captures.sqlite";

let sqlJsPromise;

function encodeJson(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

async function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: (file) => chrome.runtime.getURL(`src/vendor/${file}`)
    });
  }

  return sqlJsPromise;
}

function openDatabase(SQL, buffer) {
  if (buffer && buffer.byteLength > 0) {
    return new SQL.Database(new Uint8Array(buffer));
  }

  return new SQL.Database();
}

function ensureSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      schemaVersion TEXT,
      captureType TEXT,
      savedAt TEXT,
      sourceUrl TEXT,
      sourceTitle TEXT,
      sourceSite TEXT,
      sourceLanguage TEXT,
      sourcePublishedAt TEXT,
      sourceMetadata TEXT,
      selectedText TEXT,
      documentText TEXT,
      documentTextCompressed TEXT,
      comment TEXT,
      transcriptText TEXT,
      transcriptSegments TEXT,
      diagnostics TEXT
    );
  `);

  db.run(`CREATE INDEX IF NOT EXISTS captures_savedAt ON captures(savedAt);`);
  db.run(`CREATE INDEX IF NOT EXISTS captures_type ON captures(captureType);`);
}

function insertCapture(db, record) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO captures (
      id,
      schemaVersion,
      captureType,
      savedAt,
      sourceUrl,
      sourceTitle,
      sourceSite,
      sourceLanguage,
      sourcePublishedAt,
      sourceMetadata,
      selectedText,
      documentText,
      documentTextCompressed,
      comment,
      transcriptText,
      transcriptSegments,
      diagnostics
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run([
    record.id,
    record.schemaVersion,
    record.captureType,
    record.savedAt,
    record.source?.url || null,
    record.source?.title || null,
    record.source?.site || null,
    record.source?.language || null,
    record.source?.publishedAt || null,
    encodeJson(record.source?.metadata || null),
    record.content?.selectedText ?? null,
    record.content?.documentText ?? null,
    encodeJson(record.content?.documentTextCompressed ?? null),
    record.content?.comment ?? null,
    record.content?.transcriptText ?? null,
    encodeJson(record.content?.transcriptSegments ?? null),
    encodeJson(record.diagnostics ?? null)
  ]);

  stmt.free();
}

export async function saveRecordToSqlite(directoryHandle, record, dbFileName = DEFAULT_DB_NAME) {
  const SQL = await getSqlJs();
  const fileHandle = await directoryHandle.getFileHandle(dbFileName, { create: true });
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();

  const db = openDatabase(SQL, buffer);
  ensureSchema(db);
  insertCapture(db, record);

  const binaryArray = db.export();
  db.close();

  const writable = await fileHandle.createWritable();
  await writable.write(binaryArray);
  await writable.close();

  return dbFileName;
}
