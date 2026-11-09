# MediStore

MediStore is an offline-first, single-user Windows desktop pharmacy application. React, Vite, and Material UI provide the screens; Electron's main process handles local operations and SQLite stores records on the computer. The app does not require an internet connection, remote API, Express server, or cloud service.

Each screen has its own lazy-loaded file under `src/pages/`, so navigation opens separate pages instead of rendering all screens together.

## Run the desktop app

```sh
npm install
npm run electron:dev
```

The development command starts Vite on the loopback interface and opens the Electron desktop window. The app's pharmacy records are stored in `medical_store.db` in Electron's `app.getPath("userData")` directory (normally `%APPDATA%\\medical-store` on Windows) and persist across restarts. This location is outside the installation directory, so installing an update or uninstalling the app does not remove the database. An unfinished New Sale cart is also saved locally and restored when the app reopens; completing or clearing the cart removes that saved draft. The existing database is migrated in place; it is not deleted or recreated.

`npm run dev` is only the browser UI preview and uses in-memory demonstration data. Use Electron to test persistent offline storage.

## Local architecture

- `electron/main.cjs` receives validated app requests through IPC.
- `electron/preload.cjs` exposes a narrow `window.medicalStore.request()` bridge; Node, filesystem, and raw IPC access are not exposed to the renderer.
- `electron/api.cjs` performs local validation, parameterized SQLite queries, and transactional sales/purchases.
- `electron/database.cjs` creates the initial schema and safely adds missing columns/indexes to existing databases.

The local IPC request supports the app's auth/session, medicine CRUD, batch and inventory lookup, customer CRUD/history, supplier CRUD, purchase history/receiving, sales/invoices, reports, dashboard summary, and settings operations. The catalog form requires the first batch and opening quantity when adding a medicine; the medicine, batch, and purchase history are saved in one transaction. Later batches can still be added when restocking. Inventory sale lines validate batch ownership, expiry, and current stock; manually entered OTC sale lines save a medicine/unit/price snapshot without creating a catalog or batch record or changing stock. Manual entry requires staff confirmation that no prescription or regulated record is required, and a medicine already registered in the catalog cannot be sold through the manual path if its eligible batch is unavailable. The database calculates line and sale totals and saves all sale lines and stock changes in one transaction.

The database migration adds medicine details/prices, batch supplier metadata, customer email/timestamps, sale payment method, purchase history, invoice item snapshots, nullable batch references for manual sale lines, and search/date indexes. Existing tables and invoice records are retained.

On **New Sale**, use **Medicine Not Found? Add Manually** for an item not registered in the catalog. The dialog captures its name, unit, quantity, unit price, and optional details; the item appears in the current cart and can be edited or removed before checkout. The OTC confirmation is required because the application does not currently implement prescription capture or verification. Prescription or otherwise regulated items must not be entered through this manual form. Saved invoices retain manual item details and identify those lines as **Manual Item** in the invoice view and PDF.

The packaged Electron app uses hash-based routes so navigation keeps the trusted `file://` frontend URL intact; browser and Vite preview use regular history routes.

## Database backup and restore

Open **Settings** in the Electron app to create a SQLite backup or restore from one. Backups are validated with SQLite's integrity check and MediStore table/column checks. Restore requires confirmation and saves a separate recovery copy of the current database before replacing it; the selected backup is staged and validated before the active database is changed. The browser preview does not have access to local database files.

Supplier and purchase operations are available through the local database API; the current UI does not include dedicated supplier or purchase screens.

## Windows installer

```sh
npm run electron:build
```

This builds the renderer and creates a timestamped x64 Windows NSIS installer candidate under `release/`, without overwriting an existing installer. Verify the candidate before promoting it to `MediStore-Setup-<version>-win-x64.exe`. Packaging stages in a unique local temporary directory before copying the candidate into `release/`, avoiding file-locking issues in cloud-synced workspaces. Set `MEDISTORE_KEEP_STAGING=1` when building to retain the unpacked app for isolated packaged-app checks; remove that temporary staging directory after verification. The Windows x64 `better-sqlite3` prebuilt addon is packaged and unpacked from the app archive; native rebuilding is disabled so packaging does not require Visual Studio C++ Build Tools.

Uninstalling preserves the user's app data. Keep regular backups from **Settings → Database backup and restore**; uninstalling the application does not create a backup automatically.

## Checks

```sh
npm run lint
npm test
npm run build
```

`npm run electron:smoke` starts the desktop app with an isolated validation profile and verifies renderer startup, the preload bridge, IPC, and SQLite initialization without using the user's database. The test runner uses a forked Vitest pool to isolate SQLite native-module tests from the Electron/Node host.
