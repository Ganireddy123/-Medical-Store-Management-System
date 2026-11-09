import { configureStore, createSlice } from "@reduxjs/toolkit";

export const CART_DRAFT_KEY = "medistore_sale_draft";
const emptyCart = () => ({ items: [], customerId: "", payment: "cash", discount: 0, taxRate: 5 });

export function readCartDraft(storage) {
  try {
    const draftStorage = storage ?? globalThis.localStorage;
    if (!draftStorage) return { ...emptyCart(), draftRestored: false, draftLoadError: "" };
    const serialized = draftStorage.getItem(CART_DRAFT_KEY);
    if (!serialized) return { ...emptyCart(), draftRestored: false, draftLoadError: "" };
    const saved = JSON.parse(serialized);
    if (!saved || !Array.isArray(saved.items) || saved.items.some((item) =>
      !item || (item.is_manual_item
        ? typeof item.manual_id !== "string" || !item.manual_id || typeof item.name !== "string" ||
          typeof item.unit !== "string" || !Number.isSafeInteger(Number(item.quantity)) ||
          !Number.isFinite(Number(item.price)) || Number(item.price) <= 0
        : !Number.isSafeInteger(Number(item.medicine_id)) || !Array.isArray(item.allocations)))) {
      throw new Error("Saved sale data has an invalid format.");
    }
    return {
      ...emptyCart(),
      ...saved,
      draftRestored: saved.items.length > 0,
      draftLoadError: "",
    };
  } catch (error) {
    console.error("Unable to restore saved sale:", error);
    return { ...emptyCart(), draftRestored: false, draftLoadError: error.message || "Saved sale could not be restored." };
  }
}

export function writeCartDraft(storage, cart) {
  if (!storage) throw new Error("Local storage is unavailable; this sale cannot be saved for recovery.");
  if (!cart.items.length) {
    storage.removeItem(CART_DRAFT_KEY);
    return;
  }
  const { items, customerId, payment, discount, taxRate } = cart;
  storage.setItem(CART_DRAFT_KEY, JSON.stringify({ items, customerId, payment, discount, taxRate }));
}

function allocateMedicineQuantity(item, quantity) {
  let remaining = Math.min(quantity, item.stock);
  const allocations = [];
  for (const batch of item.batches) {
    const batchQuantity = Math.min(remaining, Number(batch.quantity));
    if (batchQuantity > 0) {
      allocations.push({ ...batch, quantity: batchQuantity });
      remaining -= batchQuantity;
    }
    if (!remaining) break;
  }
  const allocated = quantity - remaining;
  if (allocated > 0) {
    item.allocations = allocations;
    item.quantity = allocated;
  }
}

const authSlice = createSlice({
  name: "auth", initialState: { user: null },
  reducers: { setUser: (state, action) => { state.user = action.payload; } },
});
const cartSlice = createSlice({
  name: "cart", initialState: readCartDraft(),
  reducers: {
    addMedicine: (state, action) => {
      const { medicine, batches } = action.payload;
      let item = state.items.find((entry) => entry.medicine_id === medicine.id);
      if (!item) {
        item = {
          medicine_id: medicine.id,
          name: medicine.name,
          strength: medicine.strength,
          stock: batches.reduce((sum, batch) => sum + Number(batch.quantity), 0),
          quantity: 0,
          batches,
          allocations: [],
        };
        state.items.push(item);
      } else {
        item.batches = batches;
        item.stock = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
      }
      allocateMedicineQuantity(item, item.quantity + 1);
    },
    addManualItem: (state, action) => {
      state.items.push({ ...action.payload, is_manual_item: true });
    },
    setManualQuantity: (state, action) => {
      const item = state.items.find((entry) => entry.is_manual_item && entry.manual_id === action.payload.id);
      const quantity = Number(action.payload.quantity);
      if (item && Number.isSafeInteger(quantity) && quantity > 0) item.quantity = quantity;
    },
    removeManualItem: (state, action) => {
      state.items = state.items.filter((item) => !item.is_manual_item || item.manual_id !== action.payload);
    },
    setMedicineQuantity: (state, action) => {
      const item = state.items.find((entry) => entry.medicine_id === action.payload.id);
      if (item) allocateMedicineQuantity(item, Math.max(1, Math.min(item.stock, action.payload.quantity)));
    },
    removeMedicine: (state, action) => {
      state.items = state.items.filter((item) => item.medicine_id !== action.payload);
    },
    addItem: (state, action) => {
      const existing = state.items.find((item) => item.batch_id === action.payload.batch_id);
      if (existing) existing.quantity = Math.min(existing.stock, existing.quantity + 1);
      else state.items.push({ ...action.payload, quantity: 1 });
    },
    setQuantity: (state, action) => {
      const item = state.items.find((entry) => entry.batch_id === action.payload.id);
      if (item) item.quantity = Math.max(1, Math.min(item.stock, action.payload.quantity));
    },
    removeItem: (state, action) => {
      state.items = state.items.filter((item) => item.batch_id !== action.payload);
    },
    setCartField: (state, action) => { state[action.payload.field] = action.payload.value; },
    clearCart: (state) => {
      state.items = [];
      state.customerId = "";
      state.discount = 0;
      state.draftRestored = false;
      state.draftLoadError = "";
    },
  },
});
const customerSlice = createSlice({
  name: "customer", initialState: { items: [] },
  reducers: { setCustomers: (state, action) => { state.items = action.payload || []; } },
});
const medicineSlice = createSlice({
  name: "medicine", initialState: { items: [] },
  reducers: { setMedicines: (state, action) => { state.items = action.payload || []; } },
});

export const { setUser } = authSlice.actions;
export const {
  addMedicine, setMedicineQuantity, removeMedicine, addManualItem, setManualQuantity, removeManualItem,
  addItem, setQuantity, removeItem, setCartField, clearCart,
} = cartSlice.actions;
export const { setCustomers } = customerSlice.actions;
export const { setMedicines } = medicineSlice.actions;
export const store = configureStore({ reducer: {
  auth: authSlice.reducer, cart: cartSlice.reducer, customer: customerSlice.reducer, medicine: medicineSlice.reducer,
} });

let lastCart = store.getState().cart;
store.subscribe(() => {
  const cart = store.getState().cart;
  if (cart === lastCart) return;
  lastCart = cart;
  let storage;
  try {
    storage = globalThis.localStorage;
  } catch (error) {
    console.error("Unable to access sale draft storage:", error);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("medistore:draft-storage-error", {
        detail: error.message || "Unable to access sale draft storage.",
      }));
    }
    return;
  }
  if (!storage) return;
  try {
    writeCartDraft(storage, cart);
  } catch (error) {
    console.error("Unable to save sale draft:", error);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("medistore:draft-storage-error", {
        detail: error.message || "Unable to save sale draft.",
      }));
    }
  }
});
