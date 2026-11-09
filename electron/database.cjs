
const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), {
    recursive: true,
  });

  const db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generic_name TEXT,
      manufacturer TEXT,
      unit TEXT NOT NULL DEFAULT 'strip',
      strength TEXT,
      category TEXT,
      selling_price REAL NOT NULL DEFAULT 0,
      buying_price REAL,
      reorder_level INTEGER NOT NULL DEFAULT 10,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      purchase_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      supplier_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(medicine_id, batch_number),
      FOREIGN KEY(medicine_id) REFERENCES medicines(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER,
      sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      FOREIGN KEY(customer_id)
        REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      batch_id INTEGER,
      medicine_name TEXT NOT NULL,
      generic_name TEXT,
      manufacturer TEXT,
      batch_number TEXT,
      expiry_date TEXT,
      unit TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      is_manual_item INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      batch_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
      purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY(batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  addColumnIfMissing(db, "medicines", "strength", "TEXT");
  addColumnIfMissing(db, "medicines", "generic_name", "TEXT");
  addColumnIfMissing(db, "medicines", "manufacturer", "TEXT");
  addColumnIfMissing(db, "medicines", "unit", "TEXT NOT NULL DEFAULT 'strip'");
  addColumnIfMissing(db, "medicines", "category", "TEXT");
  addColumnIfMissing(db, "medicines", "selling_price", "REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "medicines", "buying_price", "REAL");
  addColumnIfMissing(db, "medicines", "reorder_level", "INTEGER NOT NULL DEFAULT 10");
  addColumnIfMissing(db, "medicines", "description", "TEXT");
  addColumnIfMissing(db, "batches", "supplier_id", "INTEGER");
  addColumnIfMissing(db, "batches", "created_at", "TEXT");
  addColumnIfMissing(db, "customers", "email", "TEXT");
  addColumnIfMissing(db, "customers", "created_at", "TEXT");
  addColumnIfMissing(db, "sales", "payment_method", "TEXT NOT NULL DEFAULT 'cash'");

  const saleItemColumns = db.prepare("PRAGMA table_info(sale_items)").all();
  const batchColumn = saleItemColumns.find((column) => column.name === "batch_id");
  const batchNumberColumn = saleItemColumns.find((column) => column.name === "batch_number");
  if (batchColumn?.notnull || batchNumberColumn?.notnull) {
    db.exec("DROP INDEX IF EXISTS idx_sale_items_sale");
    db.transaction(() => {
      db.exec("ALTER TABLE sale_items RENAME TO sale_items_legacy");
      db.exec(`
        CREATE TABLE sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          batch_id INTEGER,
          medicine_name TEXT NOT NULL,
          generic_name TEXT,
          manufacturer TEXT,
          batch_number TEXT,
          expiry_date TEXT,
          unit TEXT NOT NULL DEFAULT '',
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          line_total REAL NOT NULL,
          is_manual_item INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY(sale_id) REFERENCES sales(id),
          FOREIGN KEY(batch_id) REFERENCES batches(id)
        );
        INSERT INTO sale_items (
          id, sale_id, batch_id, medicine_name, generic_name, manufacturer,
          batch_number, expiry_date, unit, quantity, unit_price, line_total, is_manual_item
        )
        SELECT si.id, si.sale_id, si.batch_id, si.medicine_name, NULL, NULL,
          si.batch_number, NULL, '', si.quantity, si.unit_price, si.line_total, 0
        FROM sale_items_legacy si;
        DROP TABLE sale_items_legacy;
      `);
    })();
  } else {
    addColumnIfMissing(db, "sale_items", "generic_name", "TEXT");
    addColumnIfMissing(db, "sale_items", "manufacturer", "TEXT");
    addColumnIfMissing(db, "sale_items", "expiry_date", "TEXT");
    addColumnIfMissing(db, "sale_items", "unit", "TEXT NOT NULL DEFAULT ''");
    addColumnIfMissing(db, "sale_items", "is_manual_item", "INTEGER NOT NULL DEFAULT 0");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
    CREATE INDEX IF NOT EXISTS idx_batches_medicine_expiry ON batches(medicine_id, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_customers_name_phone ON customers(name, phone);
    CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_batch ON purchases(batch_id);
  `);

  return db;
}

module.exports = { initDatabase };
