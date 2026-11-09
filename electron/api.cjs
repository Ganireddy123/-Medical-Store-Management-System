const LOCAL_DATE = "date('now', 'localtime')";

function badRequest(message) {
  const error = new Error(message);
  error.code = "VALIDATION";
  throw error;
}

function requireId(id, label = "ID") {
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value <= 0) badRequest(`${label} must be a positive integer.`);
  return value;
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) badRequest(`${label} must be an object.`);
  return value;
}

function requireText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) badRequest(`${label} is required.`);
  const clean = value.trim();
  if (clean.length > maxLength) badRequest(`${label} must be ${maxLength} characters or fewer.`);
  return clean;
}

function optionalText(value, label, maxLength = 500) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) badRequest(`${label} must be ${maxLength} characters or fewer.`);
  return value.trim() || null;
}

function nonNegativeNumber(value, label, nullable = false) {
  if ((value === "" || value == null) && nullable) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) badRequest(`${label} must be a non-negative number.`);
  return number;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) badRequest(`${label} must be a positive whole number.`);
  return number;
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) badRequest(`${label} must be a non-negative whole number.`);
  return number;
}

function dateOnly(value, label = "Expiry date") {
  const match = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  if (!match || !parsed || parsed.getUTCFullYear() !== Number(match[1]) ||
      parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) {
    badRequest(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  return value;
}

function jsonSettings(db) {
  const saved = Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map(({ key, value }) => [key, value]));
  return {
    name: saved.name || "MediStore Pharmacy",
    phone: saved.phone || "",
    email: saved.email || "",
    currency: saved.currency || "INR",
    address: saved.address || "",
    taxRate: Number(saved.taxRate ?? saved.tax_rate ?? 5),
    invoiceFooter: saved.invoiceFooter || "Thank you for your purchase. Medicines sold are non-returnable unless defective.",
  };
}

function medicineRow(db, id) {
  return db.prepare(`
    SELECT m.*,
      COALESCE(SUM(CASE WHEN b.expiry_date >= ${LOCAL_DATE} THEN b.quantity ELSE 0 END), 0) AS available_stock
    FROM medicines m LEFT JOIN batches b ON b.medicine_id = m.id
    WHERE m.id = ? GROUP BY m.id
  `).get(id);
}

function listMedicines(db, search = "") {
  return db.prepare(`
    SELECT m.*,
      COALESCE(SUM(CASE WHEN b.expiry_date >= ${LOCAL_DATE} THEN b.quantity ELSE 0 END), 0) AS available_stock
    FROM medicines m LEFT JOIN batches b ON b.medicine_id = m.id
    WHERE (? = '' OR m.name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ? OR m.category LIKE ?)
    GROUP BY m.id ORDER BY m.name COLLATE NOCASE
  `).all(search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`).map((medicine) => ({
    ...medicine,
    batches: db.prepare("SELECT * FROM batches WHERE medicine_id = ? ORDER BY expiry_date, batch_number").all(medicine.id),
  }));
}

function batchRows(db, clause = "", params = []) {
  return db.prepare(`
    SELECT b.*, b.purchase_price AS buying_price, m.name AS name,
      m.generic_name, m.strength, m.manufacturer, m.category, m.reorder_level,
      m.name AS medicine_name
    FROM batches b JOIN medicines m ON m.id = b.medicine_id
    ${clause}
    ORDER BY b.expiry_date, m.name COLLATE NOCASE, b.batch_number
  `).all(...params).map((batch) => ({
    ...batch,
    medicine: {
      id: batch.medicine_id, name: batch.medicine_name, generic_name: batch.generic_name,
      strength: batch.strength, manufacturer: batch.manufacturer, category: batch.category,
      reorder_level: batch.reorder_level,
    },
  }));
}

function customerRows(db, query = "") {
  return db.prepare(`
    SELECT c.*, c.created_at
    FROM customers c
    WHERE (? = '' OR c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)
    ORDER BY c.name COLLATE NOCASE
  `).all(query, `%${query}%`, `%${query}%`, `%${query}%`);
}

function saleItems(db, saleId) {
  return db.prepare(`
    SELECT id, batch_id, medicine_name, generic_name, manufacturer,
      batch_number, expiry_date, unit, quantity, is_manual_item,
      unit_price AS price, line_total
    FROM sale_items WHERE sale_id = ? ORDER BY id
  `).all(saleId).map((item) => ({
    ...item,
    is_manual_item: Boolean(item.is_manual_item),
    medicine_id: null,
  }));
}

function saleRow(db, id) {
  const sale = db.prepare(`
    SELECT s.id, s.invoice_number, s.sold_at AS date, s.customer_id, s.payment_method,
      s.subtotal, s.discount, s.tax, s.total,
      c.name AS customer_name, c.phone AS customer_phone
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(id);
  if (!sale) return undefined;
  return {
    ...sale,
    customer: sale.customer_id == null ? null : {
      id: sale.customer_id, name: sale.customer_name, phone: sale.customer_phone,
    },
    items: saleItems(db, sale.id),
  };
}

function listSales(db, params = {}) {
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 100));
  const offset = Math.max(0, Number(params.offset) || 0);
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const from = params.from ? dateOnly(params.from, "Start date") : "";
  const to = params.to ? dateOnly(params.to, "End date") : "";
  const ids = db.prepare(`
    SELECT s.id FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE (? = '' OR s.invoice_number LIKE ? OR c.name LIKE ? OR s.payment_method LIKE ?)
      AND (? = '' OR date(s.sold_at, 'localtime') >= ?)
      AND (? = '' OR date(s.sold_at, 'localtime') <= ?)
    ORDER BY s.sold_at DESC, s.id DESC LIMIT ? OFFSET ?
  `).all(search, `%${search}%`, `%${search}%`, `%${search}%`, from, from, to, to, limit, offset);
  return ids.map(({ id }) => saleRow(db, id));
}

function saveMedicine(db, data, id) {
  requireObject(data, "Medicine details");
  if (data.selling_price == null || data.selling_price === "") badRequest("Selling price is required.");
  const values = {
    name: requireText(data.name, "Medicine name"),
    generic_name: optionalText(data.generic_name, "Generic name"),
    manufacturer: optionalText(data.manufacturer, "Manufacturer"),
    unit: optionalText(data.unit, "Unit", 40) || "strip",
    strength: optionalText(data.strength, "Strength", 80),
    category: optionalText(data.category, "Category", 100),
    selling_price: nonNegativeNumber(data.selling_price ?? 0, "Selling price"),
    buying_price: nonNegativeNumber(data.buying_price, "Buying price", true),
    reorder_level: data.reorder_level == null || data.reorder_level === "" ? 10 : nonNegativeInteger(data.reorder_level, "Reorder level"),
    description: optionalText(data.description, "Description", 2000),
  };
  if (id == null) {
    try {
      const createMedicine = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO medicines (name, generic_name, manufacturer, unit, strength, category, selling_price, buying_price, reorder_level, description)
          VALUES (@name, @generic_name, @manufacturer, @unit, @strength, @category, @selling_price, @buying_price, @reorder_level, @description)
        `).run(values);
        const medicineId = Number(result.lastInsertRowid);
        if (data.initial_batch != null) insertBatch(db, medicineId, data.initial_batch, true);
        return medicineRow(db, medicineId);
      });
      return createMedicine();
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") badRequest("A batch with this number already exists for the medicine.");
      throw error;
    }
  }
  const medicineId = requireId(id, "Medicine ID");
  const result = db.prepare(`
    UPDATE medicines SET name=@name, generic_name=@generic_name, manufacturer=@manufacturer, unit=@unit,
      strength=@strength, category=@category, selling_price=@selling_price, buying_price=@buying_price,
      reorder_level=@reorder_level, description=@description WHERE id=@id
  `).run({ ...values, id: medicineId });
  if (!result.changes) badRequest("Medicine not found.");
  return medicineRow(db, medicineId);
}

function saveCustomer(db, data, id) {
  requireObject(data, "Customer details");
  const name = requireText(data.name, "Customer name");
  const phone = requireText(data.phone, "Customer phone", 40);
  const email = optionalText(data.email, "Email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) badRequest("Enter a valid email address.");
  const address = optionalText(data.address, "Address", 1000);
  if (id == null) {
    const result = db.prepare("INSERT INTO customers (name, phone, email, address, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))").run(name, phone, email, address);
    return db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(result.lastInsertRowid));
  }
  const customerId = requireId(id, "Customer ID");
  const result = db.prepare("UPDATE customers SET name=?, phone=?, email=?, address=? WHERE id=?").run(name, phone, email, address, customerId);
  if (!result.changes) badRequest("Customer not found.");
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
}

function insertBatch(db, medicineId, data, requireStock = false) {
  const id = requireId(medicineId, "Medicine ID");
  if (!db.prepare("SELECT 1 FROM medicines WHERE id=?").get(id)) badRequest("Medicine not found.");
  requireObject(data, "Batch details");
  const batchNumber = requireText(data.batch_number, "Batch number", 100);
  const expiry = dateOnly(data.expiry_date);
  const buying = nonNegativeNumber(data.buying_price ?? data.purchase_price ?? 0, "Purchase price");
  const selling = nonNegativeNumber(data.selling_price ?? 0, "Selling price");
  const quantity = requireStock ? positiveInteger(data.quantity, "Opening quantity") : data.quantity == null ? 0 : nonNegativeInteger(data.quantity, "Quantity");
  const supplierId = data.supplier_id == null || data.supplier_id === "" ? null : requireId(data.supplier_id, "Supplier ID");
  if (supplierId && !db.prepare("SELECT 1 FROM suppliers WHERE id=?").get(supplierId)) badRequest("Supplier not found.");
  const result = db.prepare(`
    INSERT INTO batches (medicine_id, batch_number, expiry_date, purchase_price, selling_price, quantity, supplier_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, batchNumber, expiry, buying, selling, quantity, supplierId);
  const batchId = Number(result.lastInsertRowid);
  if (quantity > 0) {
    db.prepare("INSERT INTO purchases (supplier_id, batch_id, quantity, unit_cost, notes) VALUES (?, ?, ?, ?, ?)")
      .run(supplierId, batchId, quantity, buying, "Opening batch stock");
  }
  return db.prepare("SELECT * FROM batches WHERE id=?").get(batchId);
}

function saveBatch(db, medicineId, data) {
  try {
    return db.transaction(() => insertBatch(db, medicineId, data))();
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") badRequest("A batch with this number already exists for the medicine.");
    throw error;
  }
}

function updateBatch(db, batchId, data) {
  requireObject(data, "Batch details");
  const id = requireId(batchId, "Batch ID");
  const current = db.prepare("SELECT * FROM batches WHERE id=?").get(id);
  if (!current) badRequest("Batch not found.");
  const fields = {
    batch_number: data.batch_number == null ? current.batch_number : requireText(data.batch_number, "Batch number", 100),
    expiry_date: data.expiry_date == null ? current.expiry_date : dateOnly(data.expiry_date),
    purchase_price: data.buying_price == null && data.purchase_price == null ? current.purchase_price : nonNegativeNumber(data.buying_price ?? data.purchase_price, "Purchase price"),
    selling_price: data.selling_price == null ? current.selling_price : nonNegativeNumber(data.selling_price, "Selling price"),
    quantity: data.quantity == null ? current.quantity : nonNegativeInteger(data.quantity, "Quantity"),
  };
  db.prepare("UPDATE batches SET batch_number=?, expiry_date=?, purchase_price=?, selling_price=?, quantity=? WHERE id=?")
    .run(fields.batch_number, fields.expiry_date, fields.purchase_price, fields.selling_price, fields.quantity, id);
  return db.prepare("SELECT * FROM batches WHERE id=?").get(id);
}

function createSale(db, data) {
  requireObject(data, "Sale details");
  if (!Array.isArray(data.items) || data.items.length === 0) badRequest("Add at least one item to the sale.");
  const customerId = data.customer_id == null || data.customer_id === "" ? null : requireId(data.customer_id, "Customer ID");
  if (customerId && !db.prepare("SELECT 1 FROM customers WHERE id=?").get(customerId)) badRequest("Customer not found.");
  const paymentMethod = String(data.payment_method || "cash").toLowerCase();
  if (!["cash", "card", "upi"].includes(paymentMethod)) badRequest("Payment method must be cash, card, or upi.");
  const discount = nonNegativeNumber(data.discount ?? 0, "Discount");
  const taxRate = nonNegativeNumber(data.tax_rate ?? 0, "Tax rate");
  if (taxRate > 100) badRequest("Tax rate cannot exceed 100%.");
  const consolidated = new Map();
  const prepared = [];
  const today = db.prepare(`SELECT ${LOCAL_DATE} AS today`).get().today;
  for (const item of data.items) {
    requireObject(item, "Sale line");
    if (item.is_manual_item === true) {
      if (item.medicine_id != null || item.batch_id != null) {
        badRequest("Manual sale items cannot reference inventory medicines or batches.");
      }
      const medicineName = requireText(item.name, "Medicine name");
      const unit = requireText(item.unit, "Unit", 40);
      const quantity = positiveInteger(item.quantity, "Quantity");
      const price = nonNegativeNumber(item.price, "Selling price");
      if (price <= 0) badRequest("Selling price must be greater than zero.");
      if (item.is_otc !== true) {
        badRequest("Manual sale items are allowed only after confirming that no prescription or regulated record is required.");
      }
      const registered = db.prepare(`
        SELECT m.id, m.name,
          EXISTS (
            SELECT 1 FROM batches b
            WHERE b.medicine_id = m.id AND b.quantity > 0 AND b.expiry_date >= ?
          ) AS has_eligible_batch
        FROM medicines m
        WHERE m.name = ? COLLATE NOCASE OR m.generic_name = ? COLLATE NOCASE
      `).all(today, medicineName, medicineName);
      if (registered.length) {
        const registeredName = registered[0].name;
        badRequest(registered.some((medicine) => medicine.has_eligible_batch)
          ? `${registeredName} is registered in inventory. Add it from the catalog using an eligible batch.`
          : `${registeredName} is registered in inventory but has no eligible batch. Receive or manage stock before selling it.`);
      }
      const batchNumber = optionalText(item.batch_number, "Batch number", 100);
      const expiryDate = item.expiry_date ? dateOnly(item.expiry_date) : null;
      if (expiryDate && expiryDate < today) badRequest("An expired manually entered item cannot be sold.");
      const lineTotal = Math.round(price * quantity * 100) / 100;
      prepared.push({
        isManualItem: true,
        medicineName,
        genericName: optionalText(item.generic_name, "Generic name"),
        manufacturer: optionalText(item.manufacturer, "Manufacturer"),
        batchNumber,
        expiryDate,
        unit,
        quantity,
        price,
        lineTotal,
      });
      continue;
    }
    const medicineId = requireId(item.medicine_id, "Medicine ID");
    const batchId = requireId(item.batch_id, "Batch ID");
    const quantity = positiveInteger(item.quantity, "Quantity");
    const key = batchId;
    const existing = consolidated.get(key);
    if (existing && existing.medicineId !== medicineId) badRequest("A batch cannot be associated with multiple medicines in one sale.");
    consolidated.set(key, {
      medicineId, batchId, quantity: quantity + (existing?.quantity || 0),
    });
  }
  for (const item of consolidated.values()) {
    const batch = db.prepare(`
      SELECT b.*, m.name AS medicine_name, m.generic_name, m.manufacturer, m.unit
      FROM batches b JOIN medicines m ON m.id=b.medicine_id
      WHERE b.id=? AND b.medicine_id=?
    `).get(item.batchId, item.medicineId);
    if (!batch) badRequest("One or more selected medicine batches could not be found.");
    if (batch.expiry_date < today) badRequest(`Batch ${batch.batch_number} is expired and cannot be sold.`);
    if (batch.quantity < item.quantity) badRequest(`Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity}.`);
    const price = nonNegativeNumber(batch.selling_price, "Batch selling price");
    prepared.push({
      ...item,
      batch,
      isManualItem: false,
      medicineName: batch.medicine_name,
      genericName: batch.generic_name,
      manufacturer: batch.manufacturer,
      batchNumber: batch.batch_number,
      expiryDate: batch.expiry_date,
      unit: batch.unit,
      price,
      lineTotal: Math.round(price * item.quantity * 100) / 100,
    });
  }
  const subtotal = Math.round(prepared.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  if (discount > subtotal) badRequest("Discount cannot be greater than the sale subtotal.");
  const tax = Math.round((subtotal - discount) * taxRate / 100);
  const total = Math.round((subtotal - discount + tax) * 100) / 100;
  const transaction = db.transaction(() => {
    const next = db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS value FROM sales").get().value;
    const invoice = `INV-${String(next).padStart(6, "0")}`;
    const sale = db.prepare(`
      INSERT INTO sales (invoice_number, customer_id, subtotal, discount, tax, total, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(invoice, customerId, subtotal, discount, tax, total, paymentMethod);
    const saleId = Number(sale.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, batch_id, medicine_name, generic_name, manufacturer, batch_number,
        expiry_date, unit, quantity, unit_price, line_total, is_manual_item
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const deductStock = db.prepare("UPDATE batches SET quantity=quantity-? WHERE id=? AND quantity>=?");
    for (const item of prepared) {
      insertItem.run(
        saleId,
        item.isManualItem ? null : item.batchId,
        item.medicineName,
        item.genericName,
        item.manufacturer,
        item.batchNumber,
        item.expiryDate,
        item.unit || "",
        item.quantity,
        item.price,
        item.lineTotal,
        item.isManualItem ? 1 : 0,
      );
      if (item.isManualItem) continue;
      const updated = deductStock.run(item.quantity, item.batchId, item.quantity);
      if (updated.changes !== 1) badRequest(`Insufficient stock in batch ${item.batch.batch_number}.`);
    }
    return saleRow(db, saleId);
  });
  return transaction();
}

function reportRows(db, path, params = {}) {
  const from = params.from ? dateOnly(params.from, "Start date") : null;
  const to = params.to ? dateOnly(params.to, "End date") : null;
  if (path === "/api/reports/daily") {
    return db.prepare(`
      SELECT date(sold_at, 'localtime') AS date, ROUND(SUM(total), 2) AS revenue, COUNT(*) AS orders
      FROM sales WHERE (? IS NULL OR date(sold_at, 'localtime') >= ?)
        AND (? IS NULL OR date(sold_at, 'localtime') <= ?)
      GROUP BY date(sold_at, 'localtime') ORDER BY date
    `).all(from, from, to, to);
  }
  if (path === "/api/reports/monthly") {
    return db.prepare(`
      SELECT strftime('%Y-%m', sold_at, 'localtime') AS month_key,
        strftime('%m', sold_at, 'localtime') AS month_number,
        ROUND(SUM(total), 2) AS revenue, COUNT(*) AS orders
      FROM sales WHERE date(sold_at, 'localtime') >= date('now', 'localtime', 'start of month', '-11 months')
      GROUP BY month_key ORDER BY month_key
    `).all().map((row) => ({
      month: new Date(2000, Number(row.month_number) - 1, 1).toLocaleString("en", { month: "short" }),
      revenue: row.revenue, orders: row.orders,
    }));
  }
  if (path === "/api/reports/top-medicines") {
    return db.prepare(`
      SELECT si.medicine_name AS name, SUM(si.quantity) AS quantity,
        ROUND(SUM(si.line_total), 2) AS revenue
      FROM sale_items si JOIN sales s ON s.id=si.sale_id
      WHERE (? IS NULL OR date(s.sold_at, 'localtime') >= ?)
        AND (? IS NULL OR date(s.sold_at, 'localtime') <= ?)
      GROUP BY si.medicine_name ORDER BY quantity DESC, revenue DESC LIMIT 8
    `).all(from, from, to, to);
  }
  if (path === "/api/reports/payment-summary") {
    return db.prepare(`
      SELECT payment_method AS method, ROUND(SUM(total), 2) AS total, COUNT(*) AS orders
      FROM sales WHERE (? IS NULL OR date(sold_at, 'localtime') >= ?)
        AND (? IS NULL OR date(sold_at, 'localtime') <= ?)
      GROUP BY payment_method ORDER BY total DESC
    `).all(from, from, to, to);
  }
  badRequest("Unknown report.");
}

function handleRequest(db, method, path, data = {}, params = {}) {
  if (typeof path !== "string" || !path.startsWith("/api/")) badRequest("Invalid local API path.");
  if (method === "POST" && path === "/api/auth/login") {
    return { token: "local-offline-session", user: { name: "Store Admin", email: data.email || "admin@medistore.local" } };
  }
  if (method === "GET" && path === "/api/auth/me") {
    return { user: { name: "Store Admin", email: "admin@medistore.local" } };
  }
  if (path.startsWith("/api/reports/") && method === "GET") return reportRows(db, path, params);
  if (method === "GET" && path === "/api/medicines") return listMedicines(db, String(params.search || "").trim());
  if (method === "POST" && path === "/api/medicines") return saveMedicine(db, data);
  const medicineBatches = path.match(/^\/api\/medicines\/(\d+)\/batches$/);
  if (medicineBatches && method === "GET") {
    return db.prepare("SELECT * FROM batches WHERE medicine_id=? ORDER BY expiry_date, batch_number").all(requireId(medicineBatches[1], "Medicine ID"));
  }
  if (medicineBatches && method === "POST") return saveBatch(db, medicineBatches[1], data);
  const medicinePath = path.match(/^\/api\/medicines\/(\d+)$/);
  if (medicinePath) {
    const id = requireId(medicinePath[1], "Medicine ID");
    if (method === "GET") return medicineRow(db, id);
    if (method === "PUT") return saveMedicine(db, data, id);
    if (method === "DELETE") {
      const deleteMedicine = db.transaction(() => {
        if (db.prepare("SELECT 1 FROM batches WHERE medicine_id=? LIMIT 1").get(id)) badRequest("This medicine has batches and cannot be deleted.");
        const result = db.prepare("DELETE FROM medicines WHERE id=?").run(id);
        if (!result.changes) badRequest("Medicine not found.");
        return { id };
      });
      return deleteMedicine();
    }
  }
  if (method === "GET" && path === "/api/inventory") {
    const search = String(params.search || "").trim();
    return batchRows(db, search ? "WHERE m.name LIKE ? OR b.batch_number LIKE ?" : "", search ? [`%${search}%`, `%${search}%`] : []);
  }
  if (method === "GET" && path === "/api/inventory/low-stock") {
    return batchRows(db, "WHERE b.quantity <= m.reorder_level");
  }
  if (method === "GET" && path === "/api/inventory/expiring") {
    const days = Number(params.days ?? 30);
    if (!Number.isInteger(days) || days < 1 || days > 3650) badRequest("Expiry window must be from 1 to 3650 days.");
    return batchRows(db, `WHERE b.expiry_date <= date('now', 'localtime', '+' || ? || ' days')`, [days]);
  }
  const batchPath = path.match(/^\/api\/batches\/(\d+)$/);
  if (batchPath && method === "PUT") return updateBatch(db, batchPath[1], data);
  if (method === "GET" && path === "/api/customers") return customerRows(db, String(params.search || ""));
  if (method === "POST" && path === "/api/customers") return saveCustomer(db, data);
  const customerPath = path.match(/^\/api\/customers\/(\d+)(?:\/purchases)?$/);
  if (customerPath) {
    const id = requireId(customerPath[1], "Customer ID");
    if (method === "GET" && path.endsWith("/purchases")) return listSales(db, { search: "", limit: 200 }).filter((sale) => sale.customer_id === id);
    if (method === "GET") return db.prepare("SELECT * FROM customers WHERE id=?").get(id);
    if (method === "PUT") return saveCustomer(db, data, id);
    if (method === "DELETE") {
      const result = db.prepare("DELETE FROM customers WHERE id=?").run(id);
      if (!result.changes) badRequest("Customer not found.");
      return { id };
    }
  }
  if (method === "GET" && path === "/api/sales") return listSales(db, params);
  if (method === "POST" && path === "/api/sales") return createSale(db, data);
  const salePath = path.match(/^\/api\/sales\/(\d+)$/);
  if (salePath && method === "GET") return saleRow(db, requireId(salePath[1], "Sale ID"));
  if (method === "GET" && path === "/api/settings") return jsonSettings(db);
  if (method === "PUT" && path === "/api/settings") {
    requireObject(data, "Store settings");
    const values = { ...jsonSettings(db), ...data };
    values.name = requireText(values.name, "Store name");
    values.currency = String(values.currency || "INR").toUpperCase();
    if (!/^[A-Z]{3}$/.test(values.currency)) badRequest("Currency must be a three-letter currency code.");
    values.taxRate = nonNegativeNumber(values.taxRate, "Tax rate");
    if (values.taxRate > 100) badRequest("Tax rate cannot exceed 100%.");
    const update = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    const transaction = db.transaction(() => Object.entries(values).forEach(([key, value]) => update.run(key, String(value ?? ""))));
    transaction();
    return jsonSettings(db);
  }
  if (method === "GET" && path === "/api/purchases") {
    return db.prepare(`
      SELECT p.*, s.name AS supplier_name, b.batch_number, m.name AS medicine_name
      FROM purchases p JOIN batches b ON b.id=p.batch_id JOIN medicines m ON m.id=b.medicine_id
      LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.purchased_at DESC, p.id DESC
    `).all();
  }
  if (method === "POST" && path === "/api/purchases") {
    requireObject(data, "Purchase details");
    const batchId = requireId(data.batch_id, "Batch ID");
    const quantity = positiveInteger(data.quantity, "Quantity");
    const cost = nonNegativeNumber(data.unit_cost ?? data.buying_price ?? 0, "Unit cost");
    const supplierId = data.supplier_id == null || data.supplier_id === "" ? null : requireId(data.supplier_id, "Supplier ID");
    if (supplierId && !db.prepare("SELECT 1 FROM suppliers WHERE id=?").get(supplierId)) badRequest("Supplier not found.");
    const transaction = db.transaction(() => {
      const batch = db.prepare("SELECT id FROM batches WHERE id=?").get(batchId);
      if (!batch) badRequest("Batch not found.");
      db.prepare("UPDATE batches SET quantity=quantity+?, purchase_price=? WHERE id=?").run(quantity, cost, batchId);
      const result = db.prepare("INSERT INTO purchases (supplier_id, batch_id, quantity, unit_cost, notes) VALUES (?, ?, ?, ?, ?)")
        .run(supplierId, batchId, quantity, cost, optionalText(data.notes, "Notes", 1000));
      return db.prepare("SELECT * FROM purchases WHERE id=?").get(Number(result.lastInsertRowid));
    });
    return transaction();
  }
  if (method === "GET" && path === "/api/suppliers") {
    const search = String(params.search || "").trim();
    return db.prepare("SELECT * FROM suppliers WHERE (?='' OR name LIKE ? OR phone LIKE ?) ORDER BY name COLLATE NOCASE")
      .all(search, `%${search}%`, `%${search}%`);
  }
  if (method === "POST" && path === "/api/suppliers") {
    requireObject(data, "Supplier details");
    const name = requireText(data.name, "Supplier name");
    const result = db.prepare("INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)")
      .run(name, optionalText(data.phone, "Phone", 40), optionalText(data.address, "Address", 1000));
    return db.prepare("SELECT * FROM suppliers WHERE id=?").get(Number(result.lastInsertRowid));
  }
  const supplierPath = path.match(/^\/api\/suppliers\/(\d+)$/);
  if (supplierPath) {
    const id = requireId(supplierPath[1], "Supplier ID");
    if (method === "GET") return db.prepare("SELECT * FROM suppliers WHERE id=?").get(id);
    if (method === "PUT") {
      requireObject(data, "Supplier details");
      const current = db.prepare("SELECT * FROM suppliers WHERE id=?").get(id);
      if (!current) badRequest("Supplier not found.");
      const name = requireText(data.name ?? current.name, "Supplier name");
      db.prepare("UPDATE suppliers SET name=?, phone=?, address=? WHERE id=?")
        .run(name, optionalText(data.phone ?? current.phone, "Phone", 40), optionalText(data.address ?? current.address, "Address", 1000), id);
      return db.prepare("SELECT * FROM suppliers WHERE id=?").get(id);
    }
    if (method === "DELETE") {
      if (db.prepare("SELECT 1 FROM batches WHERE supplier_id=? UNION SELECT 1 FROM purchases WHERE supplier_id=? LIMIT 1").get(id, id)) {
        badRequest("This supplier is linked to stock or purchases and cannot be deleted.");
      }
      const result = db.prepare("DELETE FROM suppliers WHERE id=?").run(id);
      if (!result.changes) badRequest("Supplier not found.");
      return { id };
    }
  }
  if (method === "GET" && path === "/api/dashboard/summary") {
    const summary = db.prepare(`
      SELECT (SELECT COUNT(*) FROM medicines) AS medicines,
        (SELECT COALESCE(SUM(b.quantity), 0) FROM batches b WHERE b.expiry_date >= ${LOCAL_DATE}) AS available_stock,
        (SELECT COUNT(*) FROM batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.quantity <= m.reorder_level) AS low_stock,
        (SELECT COUNT(*) FROM batches WHERE expiry_date <= date('now', 'localtime', '+30 days')) AS expiring,
        (SELECT ROUND(COALESCE(SUM(total), 0), 2) FROM sales WHERE date(sold_at, 'localtime')=${LOCAL_DATE}) AS today_sales,
        (SELECT COUNT(*) FROM sales WHERE date(sold_at, 'localtime')=${LOCAL_DATE}) AS today_invoices
    `).get();
    return { ...summary, recent_sales: listSales(db, { limit: 5 }) };
  }
  badRequest(`Local operation is not implemented: ${method} ${path}`);
}

module.exports = { handleRequest };
