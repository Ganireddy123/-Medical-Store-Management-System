// Runtime validation coverage for: MediStore SQLite operations and backup recovery.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { handleRequest } = require("./api.cjs");
const { initDatabase } = require("./database.cjs");
const { createDatabaseBackup, restoreDatabaseBackup, validateDatabase } = require("./database-backup.cjs");

let directory;
let databasePath;
let db;

function api(method, route, data, params) {
  return handleRequest(db, method, route, data, params);
}

function medicine(name = "Test Medicine") {
  return api("POST", "/api/medicines", {
    name, strength: "10mg", selling_price: 12, buying_price: 7, reorder_level: 3,
  });
}

function batch(medicineId, details = {}) {
  return api("POST", `/api/medicines/${medicineId}/batches`, {
    batch_number: "BATCH-001", expiry_date: "2099-12-31", buying_price: 7,
    selling_price: 12, quantity: 10, ...details,
  });
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "medistore-review-"));
  databasePath = path.join(directory, "medical_store.db");
  db = initDatabase(databasePath);
});

afterEach(() => {
  if (db?.open) db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("catalog and customer operations", () => {
  it("creates, searches, updates, and protects medicines with stock", () => {
    const first = medicine("Paracetamol");
    const second = medicine("Ibuprofen");
    expect(api("GET", "/api/medicines", undefined, { search: "para" }).map((row) => row.id)).toEqual([first.id]);
    const updated = api("PUT", `/api/medicines/${first.id}`, { ...first, name: "Paracetamol 500mg", selling_price: 15 });
    expect(updated.name).toBe("Paracetamol 500mg");
    expect(updated.selling_price).toBe(15);
    expect(api("DELETE", `/api/medicines/${second.id}`)).toEqual({ id: second.id });
    const stocked = medicine("Stocked Medicine");
    batch(stocked.id);
    expect(() => api("DELETE", `/api/medicines/${stocked.id}`)).toThrow(/has batches/);
    expect(() => api("POST", "/api/medicines", { name: " ", selling_price: 2 })).toThrow(/required/);
    expect(() => api("POST", "/api/medicines", { name: "Invalid", selling_price: -1 })).toThrow(/non-negative/);
    expect(api("GET", "/api/medicines")).toHaveLength(2);
  });

  it("creates a new medicine and its opening batch and stock in one transaction", () => {
    const saved = api("POST", "/api/medicines", {
      name: "Opening Stock Medicine",
      selling_price: 15,
      initial_batch: {
        batch_number: "OPENING-001",
        expiry_date: "2099-12-31",
        buying_price: 8,
        selling_price: 15,
        quantity: 12,
      },
    });
    expect(saved.available_stock).toBe(12);
    expect(api("GET", `/api/medicines/${saved.id}/batches`)).toMatchObject([
      { batch_number: "OPENING-001", purchase_price: 8, selling_price: 15, quantity: 12 },
    ]);
    expect(api("GET", "/api/purchases")).toMatchObject([
      { batch_number: "OPENING-001", quantity: 12, unit_cost: 8 },
    ]);

    expect(() => api("POST", "/api/medicines", {
      name: "Invalid Opening Stock Medicine",
      selling_price: 15,
      initial_batch: {
        batch_number: "OPENING-002",
        expiry_date: "invalid-date",
        buying_price: 8,
        selling_price: 15,
        quantity: 5,
      },
    })).toThrow(/valid date/);
    expect(api("GET", "/api/medicines").map(({ name }) => name)).not.toContain("Invalid Opening Stock Medicine");
    expect(api("GET", "/api/purchases")).toHaveLength(1);
  });

  it("creates, updates, searches, and deletes customers with input validation", () => {
    const customer = api("POST", "/api/customers", {
      name: "Alex Customer", phone: "555-0100", email: "alex@example.test", address: "Main Street",
    });
    expect(api("GET", "/api/customers", undefined, { search: "alex" })[0].id).toBe(customer.id);
    expect(api("PUT", `/api/customers/${customer.id}`, {
      name: "Alex Updated", phone: "555-0101", email: "alex@example.test", address: "Second Street",
    }).name).toBe("Alex Updated");
    expect(() => api("POST", "/api/customers", { name: "Bad email", phone: "1", email: "invalid" })).toThrow(/valid email/);
    expect(api("DELETE", `/api/customers/${customer.id}`)).toEqual({ id: customer.id });
    expect(api("GET", "/api/customers")).toHaveLength(0);
  });
});

describe("legacy database migration", () => {
  it("preserves existing records while adding the current schema", () => {
    const legacyPath = path.join(directory, "legacy.db");
    const legacy = require("better-sqlite3")(legacyPath);
    legacy.exec(`
      CREATE TABLE medicines (id INTEGER PRIMARY KEY, name TEXT NOT NULL, selling_price REAL NOT NULL DEFAULT 0);
      CREATE TABLE batches (id INTEGER PRIMARY KEY, medicine_id INTEGER NOT NULL, batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL, purchase_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, address TEXT);
      CREATE TABLE sales (id INTEGER PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, customer_id INTEGER, sold_at TEXT NOT NULL, subtotal REAL NOT NULL, discount REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL);
      CREATE TABLE sale_items (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL, batch_id INTEGER NOT NULL, medicine_name TEXT NOT NULL, batch_number TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
      INSERT INTO medicines (id,name,selling_price) VALUES (7,'Legacy Medicine',14);
      INSERT INTO batches (id,medicine_id,batch_number,expiry_date,quantity) VALUES (9,7,'LEGACY-001','2099-12-31',11);
      INSERT INTO customers (id,name,phone) VALUES (4,'Legacy Customer','555-1000');
      INSERT INTO sales (id,invoice_number,sold_at,subtotal,total) VALUES (3,'INV-LEGACY','2026-10-01 12:00:00',14,14);
      INSERT INTO sale_items (id,sale_id,batch_id,medicine_name,batch_number,quantity,unit_price,line_total) VALUES (2,3,9,'Legacy Medicine','LEGACY-001',1,14,14);
      INSERT INTO settings (key,value) VALUES ('name','Legacy Store');
    `);
    legacy.close();

    const migrated = initDatabase(legacyPath);
    try {
      expect(migrated.prepare("SELECT name FROM medicines WHERE id=7").get().name).toBe("Legacy Medicine");
      expect(migrated.prepare("SELECT quantity FROM batches WHERE id=9").get().quantity).toBe(11);
      expect(migrated.prepare("SELECT invoice_number FROM sales WHERE id=3").get().invoice_number).toBe("INV-LEGACY");
      expect(migrated.prepare("SELECT medicine_name, generic_name, manufacturer, batch_number, expiry_date, unit, quantity, unit_price, line_total, is_manual_item FROM sale_items WHERE id=2").get())
        .toEqual({
          medicine_name: "Legacy Medicine",
          generic_name: null,
          manufacturer: null,
          batch_number: "LEGACY-001",
          expiry_date: null,
          unit: "",
          quantity: 1,
          unit_price: 14,
          line_total: 14,
          is_manual_item: 0,
        });
      expect(migrated.prepare("SELECT name FROM customers WHERE id=4").get().name).toBe("Legacy Customer");
      expect(migrated.prepare("SELECT COUNT(*) AS count FROM purchases").get().count).toBe(0);
      expect(migrated.prepare("SELECT payment_method FROM sales WHERE id=3").get().payment_method).toBe("cash");
    } finally {
      migrated.close();
    }
  });
});

describe("batch, supplier, and purchase operations", () => {
  it("prevents duplicate batches and validates stock, expiry, and supplier references", () => {
    const item = medicine();
    const supplier = api("POST", "/api/suppliers", { name: "Local Supplier", phone: "555-1000" });
    const created = batch(item.id, { supplier_id: supplier.id, quantity: 6 });
    expect(api("GET", `/api/medicines/${item.id}/batches`)[0].id).toBe(created.id);
    expect(() => batch(item.id, { quantity: 2 })).toThrow(/already exists/);
    expect(() => batch(item.id, { batch_number: "BAD-DATE", expiry_date: "2030-02-30" })).toThrow(/valid date/);
    expect(() => batch(item.id, { batch_number: "NEGATIVE", quantity: -1 })).toThrow(/whole number/);
    expect(() => batch(item.id, { batch_number: "BAD-SUPPLIER", supplier_id: 999 })).toThrow(/Supplier not found/);
    expect(api("GET", "/api/inventory")).toHaveLength(1);
  });

  it("receives purchases once, retains history, edits suppliers, and blocks deleting linked suppliers", () => {
    const item = medicine();
    const supplier = api("POST", "/api/suppliers", { name: "Supplier One", phone: "555-1000" });
    const createdBatch = batch(item.id, { supplier_id: supplier.id, quantity: 5 });
    expect(api("GET", "/api/purchases")).toHaveLength(1);
    const received = api("POST", "/api/purchases", {
      batch_id: createdBatch.id, supplier_id: supplier.id, quantity: 4, unit_cost: 8, notes: "Restock",
    });
    expect(received.quantity).toBe(4);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(createdBatch.id).quantity).toBe(9);
    expect(api("GET", "/api/purchases")).toHaveLength(2);
    expect(() => api("POST", "/api/purchases", {
      batch_id: createdBatch.id, supplier_id: 999, quantity: 3, unit_cost: 8,
    })).toThrow(/Supplier not found/);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(createdBatch.id).quantity).toBe(9);
    expect(api("PUT", `/api/suppliers/${supplier.id}`, { name: "Supplier Updated" }).name).toBe("Supplier Updated");
    expect(() => api("DELETE", `/api/suppliers/${supplier.id}`)).toThrow(/linked/);
    expect(api("GET", "/api/suppliers", undefined, { search: "updated" })).toHaveLength(1);
  });

  it("updates batch details and stock", () => {
    const item = medicine();
    const created = batch(item.id, { quantity: 5 });
    const updated = api("PUT", `/api/batches/${created.id}`, {
      batch_number: "BATCH-UPDATED",
      expiry_date: "2098-11-30",
      buying_price: 8,
      selling_price: 14,
      quantity: 9,
    });
    expect(updated).toMatchObject({
      batch_number: "BATCH-UPDATED",
      expiry_date: "2098-11-30",
      purchase_price: 8,
      selling_price: 14,
      quantity: 9,
    });
  });
});

describe("sales, reports, and persistence", () => {
  it("creates an invoice, calculates totals from database prices, deducts stock, and reports it", () => {
    const item = medicine();
    const stocked = batch(item.id, { quantity: 8 });
    const customer = api("POST", "/api/customers", { name: "Sale Customer", phone: "555-2000" });
    const sale = api("POST", "/api/sales", {
      customer_id: customer.id,
      items: [{ medicine_id: item.id, batch_id: stocked.id, quantity: 2, price: 9999 }],
      discount: 2, tax_rate: 5, payment_method: "cash",
    });
    expect(sale.invoice_number).toMatch(/^INV-/);
    expect(sale.subtotal).toBe(24);
    expect(sale.discount).toBe(2);
    expect(sale.tax).toBe(1);
    expect(sale.total).toBe(23);
    expect(api("GET", `/api/sales/${sale.id}`).items[0]).toMatchObject({
      price: 12, unit: "strip", is_manual_item: false, line_total: 24,
    });
    expect(api("GET", "/api/sales", undefined, { search: sale.invoice_number })[0].id).toBe(sale.id);
    expect(api("GET", `/api/customers/${customer.id}/purchases`)).toHaveLength(1);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(stocked.id).quantity).toBe(6);
    expect(api("GET", "/api/reports/top-medicines")[0].quantity).toBe(2);
    expect(api("GET", "/api/reports/payment-summary")[0].orders).toBe(1);
    const today = db.prepare("SELECT date('now', 'localtime') AS today").get().today;
    expect(api("GET", "/api/reports/daily", undefined, { from: today, to: today })[0]).toMatchObject({
      date: today, revenue: 23, orders: 1,
    });
    expect(api("GET", "/api/reports/monthly").at(-1)).toMatchObject({ revenue: 23, orders: 1 });
    expect(api("GET", "/api/dashboard/summary")).toMatchObject({ today_sales: 23, today_invoices: 1 });
    expect(() => api("PUT", "/api/settings", { name: "Bad", currency: "invalid", taxRate: 0 })).toThrow(/three-letter/);
    expect(() => api("PUT", "/api/settings", { name: "Bad", currency: "USD", taxRate: -1 })).toThrow(/non-negative/);
  });

  it("rejects expired, mismatched, over-stock, zero, and negative stock requests", () => {
    const item = medicine();
    const liveBatch = batch(item.id, { quantity: 2 });
    const expiredBatch = batch(item.id, {
      batch_number: "EXPIRED", expiry_date: "2000-01-01", quantity: 3,
    });
    const other = medicine("Other Medicine");
    expect(() => api("POST", "/api/sales", { items: [{ medicine_id: item.id, batch_id: liveBatch.id, quantity: 3 }] })).toThrow(/Insufficient stock/);
    expect(() => api("POST", "/api/sales", { items: [{ medicine_id: item.id, batch_id: expiredBatch.id, quantity: 1 }] })).toThrow(/expired/);
    expect(() => api("POST", "/api/sales", { items: [{ medicine_id: other.id, batch_id: liveBatch.id, quantity: 1 }] })).toThrow(/could not be found/);
    expect(() => api("POST", "/api/sales", {
      items: [
        { medicine_id: item.id, batch_id: liveBatch.id, quantity: 1 },
        { medicine_id: other.id, batch_id: liveBatch.id, quantity: 1 },
      ],
    })).toThrow(/multiple medicines/);
    expect(() => api("POST", "/api/sales", { items: [{ medicine_id: item.id, batch_id: liveBatch.id, quantity: 0 }] })).toThrow(/positive whole number/);
    expect(() => api("POST", "/api/sales", { items: [{ medicine_id: item.id, batch_id: liveBatch.id, quantity: -1 }] })).toThrow(/positive whole number/);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(liveBatch.id).quantity).toBe(2);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get().count).toBe(0);
  });

  it("rolls back the invoice and earlier stock deductions when a later deduction fails", () => {
    const item = medicine();
    const first = batch(item.id, { quantity: 5 });
    const second = batch(item.id, { batch_number: "BATCH-002", quantity: 5 });
    db.exec(`CREATE TRIGGER fail_second_stock_update BEFORE UPDATE OF quantity ON batches
      WHEN OLD.id = ${second.id} BEGIN SELECT RAISE(ABORT, 'simulated stock failure'); END;`);
    expect(() => api("POST", "/api/sales", {
      items: [
        { medicine_id: item.id, batch_id: first.id, quantity: 2 },
        { medicine_id: item.id, batch_id: second.id, quantity: 2 },
      ],
    })).toThrow(/simulated stock failure/);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(first.id).quantity).toBe(5);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(second.id).quantity).toBe(5);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get().count).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sale_items").get().count).toBe(0);
  });

  it("persists catalog, settings, and sale records after closing and reopening SQLite", () => {
    const item = medicine();
    const stocked = batch(item.id, { quantity: 3 });
    const saved = api("PUT", "/api/settings", { name: "Offline Pharmacy", currency: "USD", taxRate: 8 });
    const sale = api("POST", "/api/sales", {
      items: [{ medicine_id: item.id, batch_id: stocked.id, quantity: 1 }],
    });
    db.close();
    db = initDatabase(databasePath);
    expect(api("GET", "/api/medicines")).toHaveLength(1);
    expect(api("GET", "/api/sales/1").invoice_number).toBe(sale.invoice_number);
    expect(api("GET", "/api/settings").name).toBe(saved.name);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(stocked.id).quantity).toBe(2);
  });

  it("saves a manual OTC item with calculated totals without changing inventory", () => {
    const stockedMedicine = medicine("Inventory Product");
    const stock = batch(stockedMedicine.id, { quantity: 8 });
    const sale = api("POST", "/api/sales", {
      items: [{
        is_manual_item: true, is_otc: true, name: "Unlisted OTC Cream",
        generic_name: "Cream base", manufacturer: "Local Maker", unit: "tube",
        batch_number: "USER-BATCH-1", expiry_date: "2099-12-31",
        quantity: 2, price: 12.5,
      }],
      discount: 2, tax_rate: 5,
    });

    expect(sale).toMatchObject({ subtotal: 25, discount: 2, tax: 1, total: 24 });
    expect(sale.items[0]).toMatchObject({
      batch_id: null, medicine_name: "Unlisted OTC Cream", generic_name: "Cream base",
      manufacturer: "Local Maker", unit: "tube", quantity: 2, price: 12.5,
      line_total: 25, is_manual_item: true,
    });
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(stock.id).quantity).toBe(8);
  });

  it("accepts multiple manual lines and calculates the complete subtotal and tax", () => {
    const sale = api("POST", "/api/sales", {
      items: [
        { is_manual_item: true, is_otc: true, name: "Manual tablets", unit: "tablet", quantity: 2, price: 7.5 },
        { is_manual_item: true, is_otc: true, name: "Manual bottle", unit: "bottle", quantity: 1, price: 10 },
      ],
      discount: 1, tax_rate: 5,
    });
    expect(sale.items).toHaveLength(2);
    expect(sale.subtotal).toBe(25);
    expect(sale.tax).toBe(1);
    expect(sale.total).toBe(25);
  });

  it("persists manual invoice snapshots across a database restart", () => {
    const sale = api("POST", "/api/sales", {
      items: [{
        is_manual_item: true, is_otc: true, name: "Snapshot medicine",
        generic_name: "Snapshot generic", manufacturer: "Snapshot maker",
        batch_number: "SNAP-1", expiry_date: "2099-10-01",
        unit: "capsule", quantity: 3, price: 4,
      }],
    });
    db.close();
    db = initDatabase(databasePath);

    expect(api("GET", `/api/sales/${sale.id}`).items[0]).toMatchObject({
      medicine_name: "Snapshot medicine",
      generic_name: "Snapshot generic",
      manufacturer: "Snapshot maker",
      batch_number: "SNAP-1",
      expiry_date: "2099-10-01",
      unit: "capsule",
      quantity: 3,
      price: 4,
      line_total: 12,
      is_manual_item: true,
      batch_id: null,
    });
  });

  it("rejects invalid manual prices, quantities, OTC confirmations, and registered items", () => {
    const registered = medicine("Registered Medicine");
    batch(registered.id, { quantity: 0 });
    const valid = { is_manual_item: true, is_otc: true, name: "Valid unlisted", unit: "piece", quantity: 1, price: 3 };
    for (const fields of [{ price: 0 }, { price: -1 }, { price: "invalid" }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.5 }]) {
      expect(() => api("POST", "/api/sales", { items: [{ ...valid, ...fields }] })).toThrow();
    }
    expect(() => api("POST", "/api/sales", { items: [{ ...valid, name: " " }] })).toThrow(/Medicine name is required/);
    expect(() => api("POST", "/api/sales", { items: [{ ...valid, is_otc: false }] })).toThrow(/prescription or regulated record/);
    expect(() => api("POST", "/api/sales", {
      items: [{ ...valid, name: "Registered Medicine" }],
    })).toThrow(/no eligible batch/);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get().count).toBe(0);
  });

  it("rolls back manual and inventory lines together when stock deduction fails", () => {
    const item = medicine("Registered for mixed sale");
    const stock = batch(item.id, { quantity: 5 });
    db.exec(`CREATE TRIGGER fail_mixed_stock_update BEFORE UPDATE OF quantity ON batches
      WHEN OLD.id = ${stock.id} BEGIN SELECT RAISE(ABORT, 'simulated mixed stock failure'); END;`);

    expect(() => api("POST", "/api/sales", {
      items: [
        { is_manual_item: true, is_otc: true, name: "Manual OTC item", unit: "piece", quantity: 2, price: 6 },
        { medicine_id: item.id, batch_id: stock.id, quantity: 2 },
      ],
    })).toThrow(/simulated mixed stock failure/);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(stock.id).quantity).toBe(5);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get().count).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sale_items").get().count).toBe(0);
  });

  it("does not save earlier lines or deduct stock when a later line fails validation", () => {
    const item = medicine("Validation rollback medicine");
    const stock = batch(item.id, { quantity: 1 });
    expect(() => api("POST", "/api/sales", {
      items: [
        { is_manual_item: true, is_otc: true, name: "Valid manual item", unit: "piece", quantity: 1, price: 5 },
        { medicine_id: item.id, batch_id: stock.id, quantity: 2 },
      ],
    })).toThrow(/Insufficient stock/);
    expect(db.prepare("SELECT quantity FROM batches WHERE id=?").get(stock.id).quantity).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sales").get().count).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS count FROM sale_items").get().count).toBe(0);
  });
});

describe("SQLite backup and restore", () => {
  it("creates a validated backup and restores it while preserving a recovery copy", async () => {
    const original = medicine("Before Backup");
    const backupPath = path.join(directory, "MediStore-backup.db");
    await createDatabaseBackup(db, backupPath);
    expect(() => validateDatabase(backupPath)).not.toThrow();
    medicine("After Backup");

    const restored = await restoreDatabaseBackup(db, databasePath, backupPath, initDatabase);
    db = restored.db;
    expect(api("GET", "/api/medicines").map((row) => row.name)).toEqual([original.name]);
    expect(() => validateDatabase(restored.recoveryPath)).not.toThrow();
    await expect(createDatabaseBackup(db, databasePath)).rejects.toThrow(/cannot overwrite/);
  });

  it("rejects invalid backup files without closing or changing the active database", async () => {
    const item = medicine();
    const invalidPath = path.join(directory, "invalid.db");
    fs.writeFileSync(invalidPath, "not a sqlite database");
    await expect(restoreDatabaseBackup(db, databasePath, invalidPath, initDatabase)).rejects.toThrow(/not a readable/);
    expect(db.open).toBe(true);
    expect(api("GET", "/api/medicines")[0].id).toBe(item.id);
  });

  it("rejects SQLite backups that contain triggers before they can modify restored data", async () => {
    const item = medicine();
    const unsafePath = path.join(directory, "unsafe.db");
    const unsafe = require("better-sqlite3")(unsafePath);
    unsafe.exec(`
      CREATE TABLE medicines (id INTEGER PRIMARY KEY, name TEXT NOT NULL, selling_price REAL NOT NULL DEFAULT 0);
      CREATE TABLE batches (id INTEGER PRIMARY KEY, medicine_id INTEGER NOT NULL, batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL, purchase_price REAL NOT NULL DEFAULT 0, selling_price REAL NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, phone TEXT);
      CREATE TABLE sales (id INTEGER PRIMARY KEY, invoice_number TEXT NOT NULL, total REAL NOT NULL);
      CREATE TABLE sale_items (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL, batch_id INTEGER NOT NULL, quantity INTEGER NOT NULL);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TRIGGER unsafe_trigger AFTER INSERT ON medicines BEGIN DELETE FROM medicines; END;
    `);
    unsafe.close();
    await expect(restoreDatabaseBackup(db, databasePath, unsafePath, initDatabase)).rejects.toThrow(/triggers or views/);
    expect(db.open).toBe(true);
    expect(api("GET", "/api/medicines")[0].id).toBe(item.id);
  });

  it("reopens the original database if replacement initialization fails", async () => {
    const original = medicine("Keep Original");
    const backupPath = path.join(directory, "valid-backup.db");
    await createDatabaseBackup(db, backupPath);
    medicine("Do Not Lose");
    let failFirstOpen = true;
    const reopenOnceFails = (filePath) => {
      if (failFirstOpen) {
        failFirstOpen = false;
        throw new Error("simulated replacement initialization failure");
      }
      return initDatabase(filePath);
    };

    let restoreError;
    try {
      await restoreDatabaseBackup(db, databasePath, backupPath, reopenOnceFails);
    } catch (error) {
      restoreError = error;
    }
    expect(restoreError.message).toMatch(/simulated replacement initialization failure/);
    db = restoreError.reopenedDatabase;
    expect(db.open).toBe(true);
    expect(api("GET", "/api/medicines").map((row) => row.name).sort()).toEqual(["Do Not Lose", original.name].sort());
  });
});
