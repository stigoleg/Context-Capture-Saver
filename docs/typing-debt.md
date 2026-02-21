# Typing Debt

This project now runs a strict `checkJs` gate for core shared modules via `npm run typecheck:strict`.

Remaining areas to migrate into strict checks:

- `src/background.js`
- `src/content.js`
- `src/sqlite.js`
- `src/options.js`
- `src/storage.js`

Recommended next steps:

1. Introduce shared JSDoc typedefs for capture records, runtime messages, and storage results.
2. Split additional large modules into smaller typed units.
3. Expand `tsconfig.strict.json` includes module-by-module until the full runtime surface is covered.
