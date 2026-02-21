export const JSON_OUTPUT_ROOT_DIR = "json";

export function slugifySegment(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatDateSegment(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function buildJsonSubdirectories(record, settings, rootDir = JSON_OUTPUT_ROOT_DIR) {
  const segments = [rootDir];
  const typeSegment = settings.organizeByType
    ? slugifySegment(record.captureType || "capture") || "capture"
    : null;
  const dateSegment = settings.organizeByDate ? formatDateSegment(record.savedAt) : null;
  const order = settings.organizeOrder === "date_type" ? "date_type" : "type_date";

  if (order === "date_type") {
    if (dateSegment) {
      segments.push(dateSegment);
    }
    if (typeSegment) {
      segments.push(typeSegment);
    }
  } else {
    if (typeSegment) {
      segments.push(typeSegment);
    }
    if (dateSegment) {
      segments.push(dateSegment);
    }
  }

  return segments;
}

export function formatStoredPath(fileName, subdirectories) {
  if (!subdirectories || subdirectories.length === 0) {
    return fileName;
  }
  return `${subdirectories.join("/")}/${fileName}`;
}
