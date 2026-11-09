import { demoData, demoDates } from "../data/demo";

const localStore = typeof window !== "undefined" ? window.medicalStore : undefined;
export const demoMode = !localStore;

let nextCustomerId = 20;
let nextMedicineId = 20;
let nextSaleId = 20;
const delay = () => new Promise((resolve) => setTimeout(resolve, 250));
const matchId = (path, prefix) => path.match(new RegExp(`^${prefix}/([^/]+)`))?.[1];
const medicineWithBatches = (medicine) => ({
  ...medicine,
  batches: demoData.batches.filter((batch) => batch.medicine_id === Number(medicine.id)),
});

async function demoRequest(method, path, data, params = {}) {
  await delay();
  if (path === "/api/auth/login") return { token: "demo-token", user: { name: "Store Admin", email: data?.email || "admin@medistore.in" } };
  if (path === "/api/auth/me") return { user: { name: "Store Admin", email: "admin@medistore.in" } };
  if (path === "/api/settings" && method === "GET") {
    return JSON.parse(localStorage.getItem("medistore_settings") || JSON.stringify({
      name: "MediStore Pharmacy", phone: "+91 98765 00000", email: "hello@medistore.in",
      currency: "INR", address: "12, Market Road, Bengaluru", taxRate: 5,
    }));
  }
  if (path === "/api/settings" && method === "PUT") {
    localStorage.setItem("medistore_settings", JSON.stringify(data));
    return data;
  }
  if (path === "/api/medicines" && method === "GET") return demoData.medicines.map(medicineWithBatches);
  if (path === "/api/medicines" && method === "POST") {
    const { initial_batch: initialBatch, ...medicineData } = data;
    const record = { ...medicineData, id: nextMedicineId++, selling_price: Number(data.selling_price) };
    demoData.medicines.unshift(record);
    if (initialBatch) {
      demoData.batches.unshift({
        ...initialBatch,
        id: Date.now(),
        medicine_id: record.id,
        purchase_price: Number(initialBatch.buying_price),
        selling_price: Number(initialBatch.selling_price),
        quantity: Number(initialBatch.quantity),
      });
    }
    return record;
  }
  const medicineId = matchId(path, "/api/medicines");
  if (medicineId && method === "GET" && path.endsWith("/batches")) {
    return demoData.batches.filter((batch) => batch.medicine_id === Number(medicineId));
  }
  if (medicineId && method === "POST" && path.endsWith("/batches")) {
    const batch = { ...data, id: Date.now(), medicine_id: Number(medicineId) };
    demoData.batches.unshift(batch);
    return batch;
  }
  if (medicineId && method === "GET") return demoData.medicines.find((item) => item.id === Number(medicineId));
  if (medicineId && method === "PUT") {
    const index = demoData.medicines.findIndex((item) => item.id === Number(medicineId));
    if (index < 0) throw new Error("Medicine not found");
    demoData.medicines[index] = { ...demoData.medicines[index], ...data };
    return demoData.medicines[index];
  }
  if (medicineId && method === "DELETE") {
    const id = Number(medicineId);
    if (demoData.batches.some((batch) => batch.medicine_id === id)) {
      throw new Error("This medicine has batches and cannot be deleted.");
    }
    const index = demoData.medicines.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Medicine not found");
    demoData.medicines.splice(index, 1);
    return { id };
  }
  const batchId = matchId(path, "/api/batches");
  if (batchId && method === "PUT") {
    const batch = demoData.batches.find((item) => item.id === Number(batchId));
    Object.assign(batch, data);
    return batch;
  }
  if (path === "/api/customers" && method === "GET") return demoData.customers;
  if (path === "/api/customers" && method === "POST") {
    const customer = { ...data, id: nextCustomerId++, created_at: new Date().toISOString() };
    demoData.customers.unshift(customer);
    return customer;
  }
  const customerId = matchId(path, "/api/customers");
  if (customerId && method === "GET") return demoData.customers.find((item) => item.id === Number(customerId));
  if (customerId && method === "PUT") {
    const index = demoData.customers.findIndex((item) => item.id === Number(customerId));
    if (index < 0) throw new Error("Customer not found");
    demoData.customers[index] = { ...demoData.customers[index], ...data };
    return demoData.customers[index];
  }
  if (path === "/api/sales" && method === "GET") {
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 100));
    const offset = Math.max(0, Number(params.offset) || 0);
    return demoData.sales.slice(offset, offset + limit);
  }
  if (path === "/api/sales" && method === "POST") {
    const saleItems = (data.items || []).map((item) => {
      if (!item.is_manual_item) return { ...item, is_manual_item: false };
      const name = String(item.name || "").trim();
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      if (!name) throw new Error("Medicine name is required.");
      if (!item.unit?.trim()) throw new Error("Unit is required.");
      if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number.");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Selling price must be greater than zero.");
      if (item.is_otc !== true) throw new Error("Confirm this item does not require a prescription or regulated record.");
      const registered = demoData.medicines.find((medicine) =>
        medicine.name.trim().toLowerCase() === name.toLowerCase() ||
        medicine.generic_name?.trim().toLowerCase() === name.toLowerCase());
      if (registered) throw new Error(`${name} is registered in inventory. Use an eligible batch from the catalog.`);
      return { ...item, name, medicine_name: name, line_total: Math.round(price * quantity * 100) / 100 };
    });
    const total = saleItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.price), 0);
    const discount = Number(data.discount || 0);
    const tax = Math.round(Math.max(0, total - discount) * Number(data.tax_rate || 0) / 100);
    const sale = {
      ...data, id: nextSaleId++, invoice_number: `INV-${String(301 + demoData.sales.length).padStart(4, "0")}`,
      date: new Date().toISOString(), subtotal: total, tax,
      total: total - discount + tax,
      customer: demoData.customers.find((item) => item.id === Number(data.customer_id)) || null,
      items: saleItems.map((item) => ({
        ...item,
        medicine_name: item.is_manual_item ? item.name : demoData.medicines.find((medicine) => medicine.id === Number(item.medicine_id))?.name,
        batch_number: item.is_manual_item ? item.batch_number : demoData.batches.find((batch) => batch.id === Number(item.batch_id))?.batch_number,
        unit: item.is_manual_item ? item.unit : demoData.medicines.find((medicine) => medicine.id === Number(item.medicine_id))?.unit,
      })),
    };
    sale.discount = discount;
    demoData.sales.unshift(sale);
    saleItems.filter((item) => !item.is_manual_item).forEach((item) => {
      const batch = demoData.batches.find((entry) => entry.id === Number(item.batch_id));
      if (batch) batch.quantity = Math.max(0, batch.quantity - Number(item.quantity));
    });
    return sale;
  }
  const saleId = matchId(path, "/api/sales");
  if (saleId) return demoData.sales.find((item) => item.id === Number(saleId));
  if (path === "/api/inventory" && method === "GET") return demoData.batches.map((batch) => ({
    ...batch, medicine: demoData.medicines.find((medicine) => medicine.id === batch.medicine_id),
  }));
  if (path === "/api/inventory/low-stock") return demoData.batches.filter((batch) => batch.quantity <= 10);
  if (path === "/api/inventory/expiring") {
    const days = Number(params.days || 30);
    return demoData.batches.filter((batch) => {
      const remaining = Math.ceil((new Date(batch.expiry_date) - new Date()) / 86400000);
      return remaining <= days;
    }).map((batch) => ({ ...batch, medicine: demoData.medicines.find((item) => item.id === batch.medicine_id) }));
  }
  if (path.startsWith("/api/reports/")) return reportData(path, params);
  throw new Error(`Demo endpoint not implemented: ${method} ${path}`);
}

function reportData(path) {
  if (path.includes("monthly")) return Array.from({ length: 6 }, (_, i) => ({
    month: new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1).toLocaleString("en-IN", { month: "short" }),
    revenue: [18400, 22100, 16900, 24700, 21200, 26800][i],
  }));
  if (path.includes("top-medicines")) return demoData.medicines.slice(0, 5).map((medicine, i) => ({
    name: medicine.name, quantity: 38 - i * 5, revenue: medicine.selling_price * (38 - i * 5),
  }));
  if (path.includes("payment-summary")) return ["cash", "card", "upi"].map((method, i) => ({
    method, total: [15400, 11750, 22200][i], orders: [26, 19, 34][i],
  }));
  return demoData.sales.map((sale) => ({ date: sale.date, revenue: sale.total, orders: 1 }));
}

function cloneDemoResponse(value) {
  return value === undefined ? value : structuredClone(value);
}

async function request(method, path, data, params) {
  if (localStore) return localStore.request({ method, path, data, params });
  if (demoMode) return cloneDemoResponse(await demoRequest(method, path, data, params));
}
export const get = (path, params) => request("GET", path, undefined, params);
export const post = (path, data) => request("POST", path, data);
export const put = (path, data) => request("PUT", path, data);
export const del = (path) => request("DELETE", path);
export const login = (email, password) => post("/api/auth/login", { email, password });
export const getCurrentUser = () => get("/api/auth/me");
export const getMedicines = () => get("/api/medicines");
export const getMedicine = (id) => get(`/api/medicines/${id}`);
export const createMedicine = (data) => post("/api/medicines", data);
export const updateMedicine = (id, data) => put(`/api/medicines/${id}`, data);
export const getMedicineBatches = (id) => get(`/api/medicines/${id}/batches`);
export const createBatch = (id, data) => post(`/api/medicines/${id}/batches`, data);
export const updateBatch = (id, data) => put(`/api/batches/${id}`, data);
export const getCustomers = () => get("/api/customers");
export const getCustomer = (id) => get(`/api/customers/${id}`);
export const createCustomer = (data) => post("/api/customers", data);
export const updateCustomer = (id, data) => put(`/api/customers/${id}`, data);
export const getSales = (params) => get("/api/sales", params);
export const getSale = (id) => get(`/api/sales/${id}`);
export const createSale = (data) => post("/api/sales", data);
export const getInventory = () => get("/api/inventory");
export const getLowStock = () => get("/api/inventory/low-stock");
export const getExpiring = (days) => get("/api/inventory/expiring", { days });
export const getDailyReport = (params) => get("/api/reports/daily", params);
export const getMonthlyReport = () => get("/api/reports/monthly");
export const getTopMedicinesReport = (params) => get("/api/reports/top-medicines", params);
export const getPaymentSummaryReport = (params) => get("/api/reports/payment-summary", params);
export const getSettings = () => get("/api/settings");
export const saveSettings = (data) => put("/api/settings", data);
export const api = {
  get, post, put, login, me: getCurrentUser,
  medicines: getMedicines, medicine: getMedicine, saveMedicine: (data, id) => id ? updateMedicine(id, data) : createMedicine(data),
  deleteMedicine: (id) => del(`/api/medicines/${id}`),
  batches: getMedicineBatches, createBatch, updateBatch,
  customers: getCustomers, customer: getCustomer, saveCustomer: (data, id) => id ? updateCustomer(id, data) : createCustomer(data),
  sales: getSales, sale: getSale, createSale,
  inventory: getInventory, lowStock: getLowStock, expiring: getExpiring,
  settings: getSettings, saveSettings,
  report: (name, params = {}) => get(`/api/reports/${name}`, params),
};
export const formatMoney = (amount, currency) => {
  let selectedCurrency = currency;
  if (!selectedCurrency) {
    try { selectedCurrency = JSON.parse(localStorage.getItem("medistore_settings") || "{}").currency; }
    catch { selectedCurrency = "INR"; }
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: /^[A-Z]{3}$/.test(selectedCurrency) ? selectedCurrency : "INR", maximumFractionDigits: 0,
  }).format(Number(amount || 0));
};
export const formatDate = (date) => date ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date)) : "—";
export const statusOf = (batch, reorder = 10) => {
  const days = Math.ceil((new Date(batch.expiry_date) - new Date()) / 86400000);
  if (days < 0) return "Expired";
  if (days <= 30) return "Expiring Soon";
  if (batch.quantity <= 0) return "Out of Stock";
  if (batch.quantity <= reorder) return "Low Stock";
  return "In Stock";
};
export const daysUntil = (date) => Math.ceil((new Date(date) - new Date()) / 86400000);
export const seedHelpers = demoDates;
