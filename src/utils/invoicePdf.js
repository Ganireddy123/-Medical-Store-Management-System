import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMoney } from "../API/context";

export function createInvoicePdf(sale, settings = {}) {
  const pdf = new jsPDF();
  const pdfMoney = (amount) => formatMoney(amount).replace("₹", "INR ");
  pdf.setFontSize(18);
  pdf.text(settings.name || "MediStore Pharmacy", 14, 20);
  pdf.setFontSize(10);
  pdf.text(settings.address || "", 14, 27);
  pdf.text([settings.phone, settings.email].filter(Boolean).join(" · "), 14, 33);
  pdf.setFontSize(17);
  pdf.text("INVOICE", 196, 20, { align: "right" });
  pdf.setFontSize(10);
  pdf.text(sale.invoice_number, 196, 27, { align: "right" });
  pdf.text(formatDate(sale.date), 196, 33, { align: "right" });
  pdf.text(`Billed to: ${sale.customer?.name || "Walk-in Customer"}`, 14, 45);
  if (sale.customer?.phone) pdf.text(sale.customer.phone, 14, 51);
  autoTable(pdf, {
    startY: 58,
    head: [["Medicine", "Batch", "Qty", "Unit", "Price", "Amount"]],
    body: (sale.items || []).map((item) => [
      `${item.medicine_name || item.name}${item.is_manual_item ? " (Manual Item)" : ""}`,
      item.batch_number || "—",
      String(item.quantity),
      item.unit || "—",
      pdfMoney(item.price),
      pdfMoney(item.line_total ?? item.quantity * item.price),
    ]),
  });
  let y = (pdf.lastAutoTable?.finalY || 58) + 10;
  [["Subtotal", sale.subtotal], ["Discount", -Number(sale.discount || 0)], ["Tax", sale.tax], ["Total", sale.total]].forEach(([label, amount], index) => {
    if (index === 3) y += 2;
    pdf.setFont("helvetica", index === 3 ? "bold" : "normal");
    pdf.text(String(label), 140, y);
    pdf.text(pdfMoney(amount), 196, y, { align: "right" });
    y += 7;
  });
  pdf.text(`Payment method: ${sale.payment_method?.toUpperCase() || "CASH"}`, 140, y + 2);
  return pdf;
}
