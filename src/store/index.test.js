import { afterEach, describe, expect, it } from "vitest";
import {
  addManualItem, addMedicine, CART_DRAFT_KEY, clearCart, readCartDraft, removeManualItem,
  setManualQuantity, setMedicineQuantity, store, writeCartDraft,
} from "./index";

afterEach(() => {
  store.dispatch(clearCart());
});

describe("medicine-based sale cart", () => {
  it("adds one medicine without a batch prompt and allocates quantity across batches", () => {
    const medicine = { id: 21, name: "Cetirizine", strength: "10mg", selling_price: 32 };
    store.dispatch(addMedicine({
      medicine,
      batches: [
        { id: 101, batch_number: "FIRST", selling_price: 30, quantity: 2 },
        { id: 102, batch_number: "SECOND", selling_price: 32, quantity: 4 },
      ],
    }));
    store.dispatch(setMedicineQuantity({ id: medicine.id, quantity: 5 }));

    const item = store.getState().cart.items[0];
    expect(item).toMatchObject({ medicine_id: medicine.id, name: "Cetirizine", quantity: 5, stock: 6 });
    expect(item.allocations).toEqual([
      expect.objectContaining({ id: 101, quantity: 2, selling_price: 30 }),
      expect.objectContaining({ id: 102, quantity: 3, selling_price: 32 }),
    ]);
  });

  it("caps quantity at total eligible stock and moves allocations back when quantity decreases", () => {
    const medicine = { id: 22, name: "Test medicine", strength: "5mg" };
    store.dispatch(addMedicine({
      medicine,
      batches: [
        { id: 201, batch_number: "A", selling_price: 10, quantity: 1 },
        { id: 202, batch_number: "B", selling_price: 11, quantity: 2 },
      ],
    }));
    store.dispatch(setMedicineQuantity({ id: medicine.id, quantity: 99 }));
    expect(store.getState().cart.items[0].quantity).toBe(3);

    store.dispatch(setMedicineQuantity({ id: medicine.id, quantity: 1 }));
    expect(store.getState().cart.items[0].allocations).toEqual([
      expect.objectContaining({ id: 201, quantity: 1 }),
    ]);
  });
});

describe("manual sale cart lines", () => {
  it("adds multiple manual lines and lets the user edit or remove them before saving", () => {
    store.dispatch(addManualItem({
      manual_id: "manual-one", name: "Manual tablet", unit: "tablet",
      quantity: 1, price: 4, is_otc: true,
    }));
    store.dispatch(addManualItem({
      manual_id: "manual-two", name: "Manual syrup", unit: "bottle",
      quantity: 1, price: 12, is_otc: true,
    }));
    store.dispatch(setManualQuantity({ id: "manual-one", quantity: 3 }));

    expect(store.getState().cart.items).toMatchObject([
      { manual_id: "manual-one", name: "Manual tablet", quantity: 3, price: 4, is_manual_item: true },
      { manual_id: "manual-two", name: "Manual syrup", quantity: 1, price: 12, is_manual_item: true },
    ]);
    store.dispatch(removeManualItem("manual-two"));
    expect(store.getState().cart.items.map((item) => item.manual_id)).toEqual(["manual-one"]);
  });
});

describe("sale draft persistence", () => {
  it("restores medicine lines, quantities, batch allocations, customer, payment, discount, and tax", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const draft = {
      items: [{
        medicine_id: 30,
        name: "Saved medicine",
        quantity: 3,
        stock: 6,
        batches: [{ id: 301, quantity: 6, selling_price: 12 }],
        allocations: [{ id: 301, quantity: 3, selling_price: 12 }],
      }],
      customerId: 4,
      payment: "upi",
      discount: 5,
      taxRate: 8,
    };

    writeCartDraft(storage, draft);
    expect(values.has(CART_DRAFT_KEY)).toBe(true);
    expect(readCartDraft(storage)).toMatchObject({
      ...draft,
      draftRestored: true,
      draftLoadError: "",
    });
  });

  it("removes the saved draft after the cart is cleared", () => {
    const values = new Map([[CART_DRAFT_KEY, JSON.stringify({ items: [{ medicine_id: 1, allocations: [] }] })]]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };

    writeCartDraft(storage, { items: [] });
    expect(values.has(CART_DRAFT_KEY)).toBe(false);
    expect(readCartDraft(storage).items).toEqual([]);
  });

  it("restores manual lines alongside inventory lines without losing their details", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const manualLine = {
      is_manual_item: true, manual_id: "manual-draft", name: "Draft medicine",
      unit: "capsule", quantity: 2, price: 8, is_otc: true,
    };
    writeCartDraft(storage, { items: [manualLine], customerId: "", payment: "cash", discount: 0, taxRate: 5 });

    expect(readCartDraft(storage)).toMatchObject({
      items: [manualLine],
      draftRestored: true,
      draftLoadError: "",
    });
  });
});
