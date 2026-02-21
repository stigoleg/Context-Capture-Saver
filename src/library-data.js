const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SORT_FIELDS = new Set(["savedAt", "site", "captureType", "title"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function parseDateMs(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPageSize(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(parsed, MAX_PAGE_SIZE));
}

function normalizeSortField(value) {
  const normalized = normalizeText(value);
  return SORT_FIELDS.has(normalized) ? normalized : "savedAt";
}

function normalizeSortDirection(value) {
  const normalized = normalizeLower(value);
  return SORT_DIRECTIONS.has(normalized) ? normalized : "desc";
}

function sortString(left, right) {
  return normalizeLower(left).localeCompare(normalizeLower(right));
}

export function buildCaptureSummaryFromSqlite(row) {
  const savedAt = normalizeText(row.saved_at);
  return {
    backend: "sqlite",
    captureId: normalizeText(row.capture_id),
    documentId: normalizeText(row.document_id),
    captureType: normalizeText(row.capture_type),
    savedAt,
    savedAtMs: parseDateMs(savedAt),
    sourceUrl: normalizeText(row.document_url),
    sourceTitle: normalizeText(row.document_title),
    sourceSite: normalizeText(row.document_site),
    storagePath: "SQLite",
    meta: {
      chunkCount: null
    }
  };
}

export function buildCaptureSummaryFromJsonRecord(record, storagePath) {
  const source = record?.source || {};
  const savedAt = normalizeText(record?.savedAt);
  return {
    backend: "json",
    captureId: normalizeText(record?.id),
    documentId: "",
    captureType: normalizeText(record?.captureType),
    savedAt,
    savedAtMs: parseDateMs(savedAt),
    sourceUrl: normalizeText(source.url),
    sourceTitle: normalizeText(source.title),
    sourceSite: normalizeText(source.site),
    storagePath: normalizeText(storagePath),
    meta: {
      chunkCount: Array.isArray(record?.content?.chunks) ? record.content.chunks.length : null
    }
  };
}

export function filterAndSortCaptures(captures, filters = {}, sort = {}) {
  const captureType = normalizeLower(filters.captureType);
  const site = normalizeLower(filters.site);
  const search = normalizeLower(filters.search);
  const fromDateMs = parseDateMs(filters.fromDate ? `${filters.fromDate}T00:00:00.000Z` : "");
  const toDateMs = parseDateMs(filters.toDate ? `${filters.toDate}T23:59:59.999Z` : "");
  const hasFromDate = fromDateMs > 0;
  const hasToDate = toDateMs > 0;

  const sortField = normalizeSortField(sort.field);
  const sortDirection = normalizeSortDirection(sort.direction);

  const filtered = captures.filter((capture) => {
    const typeValue = normalizeLower(capture.captureType);
    const siteValue = normalizeLower(capture.sourceSite);
    const titleValue = normalizeLower(capture.sourceTitle);
    const urlValue = normalizeLower(capture.sourceUrl);
    const savedAtMs = Number(capture.savedAtMs) || 0;

    if (captureType && typeValue !== captureType) {
      return false;
    }
    if (site && siteValue !== site) {
      return false;
    }
    if (hasFromDate && savedAtMs < fromDateMs) {
      return false;
    }
    if (hasToDate && savedAtMs > toDateMs) {
      return false;
    }
    if (search) {
      const haystack = `${titleValue} ${urlValue} ${siteValue} ${typeValue}`;
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });

  filtered.sort((left, right) => {
    let value = 0;
    if (sortField === "savedAt") {
      value = (Number(left.savedAtMs) || 0) - (Number(right.savedAtMs) || 0);
    } else if (sortField === "site") {
      value = sortString(left.sourceSite, right.sourceSite);
    } else if (sortField === "captureType") {
      value = sortString(left.captureType, right.captureType);
    } else if (sortField === "title") {
      value = sortString(left.sourceTitle, right.sourceTitle);
    }

    if (value === 0) {
      value = sortString(left.captureId, right.captureId);
    }

    return sortDirection === "asc" ? value : value * -1;
  });

  return filtered;
}

export function paginateCaptures(captures, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const normalizedPageSize = clampPageSize(pageSize);
  const total = captures.length;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const normalizedPage = Math.max(1, Math.min(Number.parseInt(String(page || ""), 10) || 1, totalPages));
  const offset = (normalizedPage - 1) * normalizedPageSize;
  const items = captures.slice(offset, offset + normalizedPageSize);
  return {
    items,
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalPages,
    hasPrev: normalizedPage > 1,
    hasNext: normalizedPage < totalPages
  };
}

export function extractFilterOptions(captures) {
  const captureTypes = new Set();
  const sites = new Set();

  for (const capture of captures) {
    const captureType = normalizeText(capture.captureType);
    const site = normalizeText(capture.sourceSite);
    if (captureType) {
      captureTypes.add(captureType);
    }
    if (site) {
      sites.add(site);
    }
  }

  return {
    captureTypes: [...captureTypes].sort((left, right) => sortString(left, right)),
    sites: [...sites].sort((left, right) => sortString(left, right))
  };
}
