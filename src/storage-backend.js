export const STORAGE_BACKENDS = ["json", "sqlite", "both"];

export function normalizeStorageBackend(value, fallback = "json") {
  if (value === "sqlite" || value === "both") {
    return value;
  }
  return fallback;
}

export function resolveStorageBackendWrites(value) {
  const storageBackend = normalizeStorageBackend(value, "json");
  return {
    storageBackend,
    writesJson: storageBackend === "json" || storageBackend === "both",
    writesSqlite: storageBackend === "sqlite" || storageBackend === "both"
  };
}
