
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { initDatabase } = require("./database.cjs");
const { handleRequest } = require("./api.cjs");
const { createDatabaseBackup, restoreDatabaseBackup, validateDatabase } = require("./database-backup.cjs");

let db;
let databasePath;
let databaseMaintenance = false;
const smokeUserData = process.argv.find((argument) => argument.startsWith("--medistore-smoke-user-data="));
if (process.argv.includes("--smoke-test") && smokeUserData) {
  app.setPath("userData", path.resolve(smokeUserData.slice("--medistore-smoke-user-data=".length)));
}

function isTrustedUrl(value) {
  try {
    const actual = new URL(value);
    if (app.isPackaged) {
      const expected = path.resolve(__dirname, "../dist/index.html");
      return actual.protocol === "file:" && path.resolve(fileURLToPath(actual)) === expected;
    }
    const devServerPort = process.argv.includes("--smoke-test") ? 5174 : 5173;
    return actual.origin === `http://127.0.0.1:${devServerPort}`;
  } catch {
    return false;
  }
}

function isTrustedSender(event) {
  return isTrustedUrl(event.senderFrame?.url || "");
}

function requestError(error) {
  return {
    ok: false,
    error: {
      code: error.code || "DATABASE",
      message: error.code?.startsWith("BACKUP_") || error.code === "VALIDATION"
        ? error.message
        : "The local database operation failed.",
    },
  };
}

ipcMain.handle("database:status", (event) => {
  if (!isTrustedSender(event)) return { connected: false };
  return { connected: Boolean(db?.open), databasePath };
});

ipcMain.handle("api:request", async (event, request = {}) => {
  if (!isTrustedSender(event)) return requestError(Object.assign(new Error("Untrusted renderer."), { code: "FORBIDDEN" }));
  if (databaseMaintenance) return requestError(Object.assign(new Error("Database maintenance is in progress."), { code: "DATABASE_MAINTENANCE" }));
  if (!db?.open) {
    return requestError(Object.assign(new Error("The local database is not ready. Restart MediStore and try again."), { code: "DATABASE_NOT_READY" }));
  }

  try {
    const { method, path: route, data, params } = request;
    if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
      return { ok: false, error: { code: "VALIDATION", message: "Unsupported local operation." } };
    }
    return { ok: true, data: handleRequest(db, method, route, data, params) };
  } catch (error) {
    console.error(`Local database operation failed (${request.method || "?"} ${request.path || "?"}):`, error);
    return requestError(error);
  }
});

ipcMain.handle("database:backup", async (event) => {
  if (!isTrustedSender(event)) return requestError(Object.assign(new Error("Untrusted renderer."), { code: "FORBIDDEN" }));
  if (!db?.open || databaseMaintenance) return requestError(Object.assign(new Error("The database is not available for backup."), { code: "DATABASE_NOT_READY" }));
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Back up MediStore database",
    defaultPath: path.join(app.getPath("documents"), `MediStore-backup-${Date.now()}.db`),
    filters: [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }],
  });
  if (canceled || !filePath) return { ok: true, cancelled: true };
  databaseMaintenance = true;
  try {
    const savedPath = await createDatabaseBackup(db, filePath);
    return { ok: true, path: savedPath };
  } catch (error) {
    console.error("Database backup failed:", error);
    return requestError(error);
  } finally {
    databaseMaintenance = false;
  }
});

ipcMain.handle("database:restore", async (event) => {
  if (!isTrustedSender(event)) return requestError(Object.assign(new Error("Untrusted renderer."), { code: "FORBIDDEN" }));
  if (!db?.open || databaseMaintenance) return requestError(Object.assign(new Error("The database is not available for restore."), { code: "DATABASE_NOT_READY" }));
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Restore MediStore database",
    properties: ["openFile"],
    filters: [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }],
  });
  if (canceled || !filePaths?.[0]) return { ok: true, cancelled: true };

  try {
    validateDatabase(filePaths[0]);
  } catch (error) {
    console.error("Selected restore file is invalid:", error);
    return requestError(error);
  }

  const confirmation = await dialog.showMessageBox({
    type: "warning",
    title: "Restore MediStore backup?",
    message: "Restoring replaces the current pharmacy database.",
    detail: "A recovery copy of the current database will be saved beside it before restoration. Continue only if you trust this backup.",
    buttons: ["Cancel", "Restore Backup"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (confirmation.response !== 1) return { ok: true, cancelled: true };

  databaseMaintenance = true;
  try {
    const restored = await restoreDatabaseBackup(db, databasePath, filePaths[0], initDatabase);
    db = restored.db;
    return { ok: true, recoveryPath: restored.recoveryPath };
  } catch (error) {
    if (error.reopenedDatabase?.open) db = error.reopenedDatabase;
    else if (!db?.open) {
      try {
        db = initDatabase(databasePath);
      } catch (reopenError) {
        console.error("Could not reopen the database after restore failed:", reopenError);
      }
    }
    console.error("Database restore failed:", error);
    return requestError(error);
  } finally {
    databaseMaintenance = false;
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: "MediStore - Medical Store Management",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  if (process.argv.includes("--smoke-test")) {
    const rendererErrors = [];
    win.webContents.on("console-message", (event) => {
      if (event.level >= 3) rendererErrors.push(`${event.message} (${event.sourceId}:${event.lineNumber})`);
    });
    win.webContents.on("render-process-gone", (_event, details) => {
      console.error("Electron renderer process exited unexpectedly:", details);
      app.exit(1);
    });
    win.webContents.once("did-finish-load", async () => {
      try {
        const result = await win.webContents.executeJavaScript(`(async () => {
          const status = await window.medicalStore.getDatabaseStatus();
          const session = await window.medicalStore.request({ method: "GET", path: "/api/auth/me" });
          const marker = "__MediStore desktop smoke__";
          const batchMarker = "SMOKE-BATCH-001";
          const manualMarker = "__MediStore manual sale smoke item__";
          let medicines = await window.medicalStore.request({
            method: "GET", path: "/api/medicines", params: { search: marker },
          });
          let medicine = medicines.find((entry) => entry.name === marker);
          if (!medicine) {
            medicine = await window.medicalStore.request({
              method: "POST", path: "/api/medicines", data: { name: marker, selling_price: 0 },
            });
          }
          let batches = await window.medicalStore.request({
            method: "GET", path: "/api/medicines/" + medicine.id + "/batches",
          });
          let batch = batches.find((entry) => entry.batch_number === batchMarker);
          if (!batch) {
            batch = await window.medicalStore.request({
              method: "POST",
              path: "/api/medicines/" + medicine.id + "/batches",
              data: {
                batch_number: batchMarker,
                expiry_date: "2099-12-31",
                buying_price: 5,
                selling_price: 12,
                quantity: 8,
              },
            });
          }
          const sales = await window.medicalStore.request({
            method: "GET", path: "/api/sales", params: { limit: 200 },
          });
          let sale = sales.find((entry) => entry.items?.some((item) => item.medicine_name === manualMarker));
          if (!sale) {
            sale = await window.medicalStore.request({
              method: "POST",
              path: "/api/sales",
              data: {
                items: [{
                  is_manual_item: true,
                  is_otc: true,
                  name: manualMarker,
                  unit: "piece",
                  quantity: 2,
                  price: 7.5,
                }],
              },
            });
          }
          sale = await window.medicalStore.request({
            method: "GET", path: "/api/sales/" + sale.id,
          });
          const persistedManualItem = sale.items?.find((item) => item.medicine_name === manualMarker);
          batches = await window.medicalStore.request({
            method: "GET", path: "/api/medicines/" + medicine.id + "/batches",
          });
          const persistedBatch = batches.find((entry) => entry.batch_number === batchMarker);
          return {
            status,
            session,
            persistedMarker: medicine.name === marker,
            manualSale: {
              persisted: Boolean(persistedManualItem),
              isManual: persistedManualItem?.is_manual_item === true,
              quantity: persistedManualItem?.quantity,
              price: persistedManualItem?.price,
              lineTotal: persistedManualItem?.line_total,
              stockUnchanged: Number(persistedBatch?.quantity) === 8,
            },
          };
        })()`);
        if (!result.status.connected || result.session?.user?.name !== "Store Admin" ||
            !result.persistedMarker || !result.manualSale.persisted ||
            !result.manualSale.isManual || result.manualSale.quantity !== 2 ||
            result.manualSale.price !== 7.5 || result.manualSale.lineTotal !== 15 ||
            !result.manualSale.stockUnchanged) {
          throw new Error("Electron preload IPC returned an unexpected response.");
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (rendererErrors.length) throw new Error(`Renderer console errors: ${rendererErrors.join("; ")}`);
        console.log("Electron renderer, preload IPC, manual sale persistence, inventory isolation, and SQLite smoke test passed.");
        app.exit(0);
      } catch (error) {
        console.error("Electron renderer, preload, IPC, and SQLite smoke test failed:", error);
        app.exit(1);
      }
    });
    win.webContents.on("did-fail-load", (_event, code, description) => {
      console.error(`Electron renderer failed to load (${code}): ${description}`);
      app.exit(1);
    });
  }

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    win.loadURL(process.argv.includes("--smoke-test")
      ? "http://127.0.0.1:5174"
      : "http://127.0.0.1:5173");
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    databasePath = path.join(app.getPath("userData"), "medical_store.db");

    db = initDatabase(databasePath);
    console.log("SQLite database initialized:", databasePath);

    createWindow();
  }).catch((error) => {
    console.error("MediStore failed to initialize:", error);
    app.quit();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (db && db.open) {
    db.close();
  }
});
