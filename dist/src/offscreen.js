import { extractPdfFromUrl } from "./pdf.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OFFSCREEN_EXTRACT_PDF") {
    return undefined;
  }

  extractPdfFromUrl(message.url, {
    allowUnknownContentType: message.allowUnknownContentType,
    disableWorker: false
  })
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      sendResponse({ ok: false, error: error?.message || "PDF extraction failed" });
    });

  return true;
});
