# Context Capture Saver (Chrome Extension)

This extension stores page content (selection optional) and YouTube transcript captures as JSON files or a SQLite database in a local folder you choose.

## Features

- Right-click page or selection -> **Save content**.
- Right-click page or selection -> **Save with comment**.
- Keyboard shortcuts:
  - **Shift+Cmd+D** on macOS (**Ctrl+Shift+D** on other platforms) to save content.
  - **Shift+Cmd+C** on macOS (**Ctrl+Shift+C** on other platforms) to save with a comment.
- On YouTube pages -> right-click page -> **Save YouTube transcript**.
- Popup includes:
  - quick capture buttons
  - latest capture status (success/failure)
  - one-click access to settings
- Each JSON file includes:
  - selected text (may be empty if nothing is selected)
  - full page text snapshot (`documentText`)
  - optional compressed document text (`documentTextCompressed`) for large captures
  - optional user comment (`comment`)
  - title, URL
  - `savedAt`
  - `publishedAt` (best effort extraction)
- Storage can optionally be grouped by date and/or capture type.
- JSON folder grouping order is configurable (type → date by default).
- Folder order selection appears only when both date and type grouping are enabled.
- SQLite storage writes to `context-captures.sqlite` in the chosen folder.
- Content is never truncated; large captures can be compressed instead.
- Gzip compression is always available (built-in or bundled fallback).

## Extraction Coverage

The extension tries to capture structured data from a wide range of sources:

- Web pages:
  - selected text (optional)
  - full page text (`documentText`)
  - metadata fields when present:
    - `description`, `author`, `keywords`
    - canonical URL
    - site name
    - article tags (`article:tag`) and section (`article:section`)
    - article published/modified time (`article:published_time`, `article:modified_time`)
    - document content type and content language
  - published date (best effort)
- YouTube pages:
  - transcript text and segmented timestamps when available
  - video ID and transcript availability diagnostics
- PDFs:
  - extracted PDF text (all pages)
  - PDF metadata when available (title, author, subject, keywords, creator, producer)
  - page count and file size

## Install (Load unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Configure Local Folder

1. Open extension settings (Details -> Extension options).
2. Click **Choose folder** and pick your destination folder.
3. Optional: click **Test write** to confirm files are written.
4. Optional: configure large content policy:
   - max characters to store from page text
   - enable/disable gzip compression for large documents
   - choose compression threshold

## Development checks

- Syntax check: `npm run check`
- Unit tests: `npm test`
- Build: `npm run build` (outputs an unpacked extension in `dist/`)
- Build output also includes `dist/context-capture-saver.zip` for sharing or archival.

## Notes

- Chrome extensions cannot silently write to arbitrary paths; user folder selection is required.
- YouTube transcript extraction reads transcript rows from the page UI. If transcript is unavailable, a JSON file is still saved with diagnostics.
- `publishedAt` is heuristic and may be null on some pages.
- Compression uses `CompressionStream` when available in the extension runtime.
