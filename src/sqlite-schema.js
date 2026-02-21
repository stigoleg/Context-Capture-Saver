export {
  SQLITE_DB_SCHEMA_NAME,
  SQLITE_DB_SCHEMA_VERSION,
  ensureFtsIfPossible,
  ensureSchemaV2,
  getDbSchemaVersion,
  migrateLegacyToV2,
  runDatabaseMaintenance,
  setDbSchemaVersion
} from "./sqlite.js";
