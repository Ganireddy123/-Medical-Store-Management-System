import { describe, expect, it } from "vitest";
import { createInvoicePdf } from "./invoicePdf";

describe("manual-item invoices", () => {
  it("generates a printable PDF with the manual label, quantity, unit, price, and line total", () => {
    const pdf = createInvoicePdf({
      invoice_number: "INV-MANUAL-1",
      date: "2026-10-21",
      subtotal: 24,
      discount: 0,
      tax: 1,
      total: 25,
      payment_method: "cash",
      items: [{
        medicine_name: "Unlisted OTC tablet",
        is_manual_item: true,
        batch_number: null,
        quantity: 2,
        unit: "tablet",
        price: 12,
        line_total: 24,
      }],
    }, { name: "Test Pharmacy" });

    const contents = pdf.output();
    const pageContent = pdf.internal.pages[1].join("");
    expect(contents.startsWith("%PDF-")).toBe(true);
    expect(pageContent).toContain("Unlisted OTC tablet \\(Manual Item\\)");
    expect(pageContent).toContain("(tablet) Tj");
    expect(pageContent).toContain("(INR 12) Tj");
    expect(pageContent).toContain("(INR 24) Tj");
    expect(contents).toContain("INV-MANUAL-1");
  });
});
