const Database = require("better-sqlite3");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const requiredColumns = {
  medicines: ["id", "name", "selling_price"],
  batches: ["id", "medicine_id", "batch_number", "expiry_date", "quantity"],
  customers: ["id", "name", "phone"],
  sales: ["id", "invoice_number", "total"],
  sale_items: ["id", "sale_id", "batch_id", "quantity"],
  settings: ["key", "value"],
};

function databaseError(message, code = "BACKUP_VALIDATION") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function makeSiblingPath(databasePath, label) {
  return path.join(
    path.dirname(databasePath),
    `.${path.basename(databasePath)}-${label}-${randomUUID()}.db`
  );
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function validateDatabase(databasePath) {
  let candidate;
  try {
    candidate = new Database(databasePath, { readonly: true, fileMustExist: true });
    const integrity = candidate.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw databaseError("The selected file failed SQLite integrity validation.");
    if (candidate.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('trigger', 'view') LIMIT 1").get()) {
      throw databaseError("The selected file contains unsupported database triggers or views.");
    }

    for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
      const actualColumns = new Set(candidate.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name));
      if (!expectedColumns.every((column) => actualColumns.has(column))) {
        throw databaseError(`The selected file is missing required ${table} data.`);
      }
    }
  } catch (error) {
    if (error.code === "BACKUP_VALIDATION") throw error;
    throw databaseError("The selected file is not a readable MediStore SQLite database.");
  } finally {
    if (candidate?.open) candidate.close();
  }
}

async function createDatabaseBackup(db, destinationPath) {
  const sourcePath = path.resolve(db.name);
  const targetPath = path.resolve(destinationPath);
  if (sourcePath === targetPath) throw databaseError("A backup cannot overwrite the active database.", "BACKUP_PATH");
  if (await fileExists(targetPath)) throw databaseError("A file already exists at the selected backup path.", "BACKUP_EXISTS");

  const temporaryPath = makeSiblingPath(targetPath, "backup");
  try {
    await db.backup(temporaryPath);
    validateDatabase(temporaryPath);
    await fs.rename(temporaryPath, targetPath);
    return targetPath;
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function restoreDatabaseBackup(db, databasePath, backupPath, reopenDatabase) {
  const activePath = path.resolve(databasePath);
  const sourcePath = path.resolve(backupPath);
  const [activeRealPath, sourceRealPath] = await Promise.all([fs.realpath(activePath), fs.realpath(sourcePath)]);
  if (activeRealPath === sourceRealPath) throw databaseError("Choose a backup file, not the active database.", "BACKUP_PATH");
  validateDatabase(sourcePath);

  const stagedPath = makeSiblingPath(activePath, "restore");
  const recoveryPath = makeSiblingPath(activePath, `before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const rollbackId = randomUUID();
  const movedFiles = [];
  let restoredDb;
  let databaseClosed = false;
  let replacementInstalled = false;

  try {
    const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
    try {
      await source.backup(stagedPath);
    } finally {
      source.close();
    }
    validateDatabase(stagedPath);

    await db.backup(recoveryPath);
    validateDatabase(recoveryPath);
    db.close();
    databaseClosed = true;

    for (const suffix of ["", "-wal", "-shm"]) {
      const original = `${activePath}${suffix}`;
      if (!(await fileExists(original))) continue;
      const displaced = `${activePath}.pre-restore-${rollbackId}${suffix}`;
      await fs.rename(original, displaced);
      movedFiles.push({ original, displaced });
    }

    await fs.rename(stagedPath, activePath);
    replacementInstalled = true;
    restoredDb = reopenDatabase(activePath);
    return { db: restoredDb, recoveryPath };
  } catch (error) {
    if (restoredDb?.open) restoredDb.close();
    if (replacementInstalled && await fileExists(activePath)) await fs.rm(activePath, { force: true });
    for (const { original, displaced } of movedFiles.reverse()) {
      if (await fileExists(displaced)) await fs.rename(displaced, original);
    }
    if (databaseClosed && !db.open) {
      try {
        db = reopenDatabase(activePath);
      } catch (reopenError) {
        throw new AggregateError([error, reopenError], "Restore failed and the original database could not be reopened.");
      }
    }
    error.reopenedDatabase = db;
    throw error;
  } finally {
    await fs.rm(stagedPath, { force: true });
  }
}

module.exports = { createDatabaseBackup, restoreDatabaseBackup, validateDatabase };
