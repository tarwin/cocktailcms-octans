# Cocktail CMS

A content management system built around **data**, not pages. Define
blueprints (record types with typed fields, links and sub-records), edit
records, and export or query everything with SQL.

This is the rebuild of the original Cocktail CMS on **Vue 3**, the
[Octans UI](https://octans.dev) component library, and **SQLite compiled to
WebAssembly** in place of the old JSON-in-localStorage storage.

```sh
pnpm install
pnpm dev        # http://localhost:8888
pnpm build      # static site in dist/
pnpm typecheck
```

## How it is put together

```
src/
  core/        types, utils, platform detection, markdown, event bus
  db/          SqlDriver interface, schema, and the drivers
    drivers/wasm.worker.ts   SQLite wasm in a Web Worker (OPFS, IndexedDB fallback)
    drivers/WasmDriver.ts    main-thread proxy for the worker
    drivers/TinyjsDriver.ts  forwards SQL to the tinyjs backend
  api/         Api.ts (all data access), views.ts (SQL views), exportSql.ts
  sync/        SyncManager + providers (Puter, Google Drive)
  components/  fields (read-only cells), controls (editors), options (field settings),
               data (list / record sheet), library (files), viz (export helpers)
  pages/       routed pages
  store.ts     app-wide reactive state and boot
tinyjs/backend/main.ts   the tinyjs desktop backend (tjs:sqlite)
public/sample/           the original sample projects (still importable)
```

### Storage

Everything the UI does goes through `Api`, which only knows a `SqlDriver`.
Blueprints and fields are ordinary tables; record values are one JSON document
per record (columns are user-defined and change at runtime), queried with
SQLite's JSON functions. Files (images, attachments) are BLOBs in the same
database, so one `.sqlite3` file is the whole thing.

Each blueprint is also exposed as a SQL **view** named after its key, which is
what the Data Export page queries. Multi-value fields are JSON arrays
(`json_each()` joins them).

| Platform | Driver | Persistence |
| --- | --- | --- |
| Browser (web / Puter hosted) | `WasmDriver` | OPFS via the SAH-pool VFS (no COOP/COEP headers needed). Falls back to an IndexedDB mirror if the OPFS lock is unavailable, then to memory. |
| tinyjs.app desktop | `TinyjsDriver` | Native SQLite in the tinyjs backend, file in the app data dir. |

### Sync

`SyncManager` keeps the whole database (plus a small marker file) in a cloud
provider and pushes it a couple of seconds after each change. Providers:
**Puter** (`puter.fs`) and **Google Drive** (Google Identity Services + the
Drive REST API; set `VITE_GOOGLE_CLIENT_ID` for your own OAuth client). When
local and remote disagree the user picks a direction.

### Running inside tinyjs

`tinyjs.json` describes the app; `tinyjs/backend/main.ts` is the backend.
The frontend detects `window.tiny` and switches to `TinyjsDriver`, so the same
`dist/` build runs in the desktop webview. Build with `tinyjs build` once the
`tinyjs` CLI is installed.

### Running on Puter

Host `dist/` as a Puter site (or open the app with `?platform=puter`, or tick
"Treat this install as a Puter app" in Settings → Sync). Storage stays local
(OPFS) and Puter becomes the recommended sync target.

## Importing old data

Settings → Data accepts the original `cocktail.<project>.all.json` and
`cocktail.<project>.files.json` exports. Old `int`/`float` field types and
FontAwesome icon names are translated on the way in.
