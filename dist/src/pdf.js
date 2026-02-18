import { getDocument, GlobalWorkerOptions } from "./vendor/pdf.mjs";

GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("src/vendor/pdf.worker.mjs");

function normalizeText(value) {
  return (value || "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeGetMetadata(metadata) {
  if (!metadata) {
    return null;
  }

  if (typeof metadata.getAll === "function") {
    return metadata.getAll();
  }

  return null;
}

export async function extractPdfFromUrl(url, options = {}) {
  let contentType = "";
  let fileSizeBytes = null;

  try {
    const headResponse = await fetch(url, { method: "HEAD", credentials: "include" });
    if (headResponse.ok) {
      contentType = headResponse.headers.get("content-type") || "";
      const length = headResponse.headers.get("content-length");
      if (length) {
        const parsed = Number(length);
        fileSizeBytes = Number.isNaN(parsed) ? null : parsed;
      }
    }
  } catch (_error) {
    // HEAD may be blocked; continue with best effort.
  }

  const isPdfType = contentType.toLowerCase().includes("pdf");
  if (contentType && !isPdfType && !options.allowUnknownContentType) {
    throw new Error("URL does not appear to be a PDF.");
  }

  const disableWorker = options.disableWorker ?? true;
  let pdf;
  try {
    const loadingTask = getDocument({
      url,
      withCredentials: true,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
      disableWorker
    });
    pdf = await loadingTask.promise;
  } catch (_error) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF (status ${response.status})`);
    }

    contentType = response.headers.get("content-type") || contentType;
    const length = response.headers.get("content-length");
    if (length && fileSizeBytes === null) {
      const parsed = Number(length);
      fileSizeBytes = Number.isNaN(parsed) ? null : parsed;
    }

    const buffer = await response.arrayBuffer();
    if (fileSizeBytes === null) {
      fileSizeBytes = buffer.byteLength;
    }
    const data = new Uint8Array(buffer);
    const loadingTask = getDocument({ data, disableWorker: true });
    pdf = await loadingTask.promise;
  }

  let metadata = null;
  let info = null;
  try {
    const meta = await pdf.getMetadata();
    metadata = safeGetMetadata(meta?.metadata);
    info = meta?.info || null;
  } catch (_error) {
    metadata = null;
    info = null;
  }

  const pageTexts = [];
  let pageErrorCount = 0;
  let totalTextLength = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({ normalizeWhitespace: true });
      const strings = textContent.items
        .map((item) => item?.str)
        .filter(Boolean);
      const pageText = strings.join(" ");
      pageTexts.push(pageText);
      totalTextLength += pageText.length;
      page.cleanup();
    } catch (_error) {
      pageErrorCount += 1;
      pageTexts.push("");
    }
  }

  const normalizedParts = pageTexts.map((part) => normalizeText(part));
  pdf.cleanup();
  await pdf.destroy();

  return {
    documentTextParts: normalizedParts,
    documentTextLength: totalTextLength,
    pageCount: pdf.numPages,
    contentType,
    fileSizeBytes,
    info,
    metadata,
    pageErrorCount
  };
}
