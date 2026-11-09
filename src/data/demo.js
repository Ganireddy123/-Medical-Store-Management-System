const ago = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};
const fromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const medicines = [
  ["Paracetamol", "Acetaminophen", "500mg", "Cipla", "Pain Relief", 25, 16],
  ["Amoxicillin", "Amoxicillin", "500mg", "Sun Pharma", "Antibiotic", 85, 58],
  ["Omeprazole", "Omeprazole", "20mg", "Dr. Reddy's", "Digestive Health", 70, 42],
  ["Cetirizine", "Cetirizine", "10mg", "GSK", "Allergy", 32, 18],
  ["Metformin", "Metformin", "850mg", "USV", "Diabetes Care", 95, 63],
  ["Amlodipine", "Amlodipine", "5mg", "Cipla", "Cardiac Care", 60, 37],
  ["Azithromycin", "Azithromycin", "250mg", "Zydus", "Antibiotic", 120, 82],
  ["Ibuprofen", "Ibuprofen", "400mg", "Abbott", "Pain Relief", 40, 24],
  ["Ascoril LS Syrup", "Ambroxol + Levosalbutamol", "100ml", "Glenmark", "Respiratory", 115, 78],
  ["Calcirol", "Cholecalciferol", "60000 IU", "Cadila", "Vitamins", 45, 29],
].map(([name, generic_name, strength, manufacturer, category, selling_price, buying_price], index) => ({
  id: index + 1, name, generic_name, strength, manufacturer, category, selling_price, buying_price,
  reorder_level: 10, description: `${generic_name} ${strength} tablets`,
}));

const batches = [
  [1, "PCM-2401", 82, 240, 135], [1, "PCM-2402", 8, 12, 26], [2, "AMX-2411", 45, 190, 49],
  [3, "OMP-2388", 0, -5, 22], [4, "CTZ-2406", 36, 12, 18], [5, "MET-2412", 7, 120, 30],
  [6, "AML-2318", 24, -12, 20], [7, "AZM-2410", 18, 25, 30], [8, "IBU-2404", 56, 280, 16],
  [9, "ASC-2391", 13, 88, 54], [10, "CAL-2407", 4, 12, 22], [2, "AMX-2409", 22, 150, 51],
].map(([medicine_id, batch_number, quantity, expiry_in, buying_price], index) => ({
  id: index + 1, medicine_id, batch_number, quantity, expiry_date: fromNow(expiry_in), buying_price,
  selling_price: medicines[medicine_id - 1].selling_price,
}));

const customers = [
  ["Ananya Sharma", "+91 98765 43210", "ananya.sharma@email.com", "12, Green Park, New Delhi"],
  ["Rohan Mehta", "+91 98123 45670", "rohan.mehta@email.com", "Bandra West, Mumbai"],
  ["Priya Patel", "+91 98980 12345", "priya.patel@email.com", "Satellite Road, Ahmedabad"],
  ["Arjun Reddy", "+91 98490 56789", "arjun.reddy@email.com", "Jubilee Hills, Hyderabad"],
  ["Meera Nair", "+91 98470 98765", "meera.nair@email.com", "Kakkanad, Kochi"],
  ["Kabir Singh", "+91 98720 34567", "kabir.singh@email.com", "Sector 17, Chandigarh"],
].map(([name, phone, email, address], index) => ({
  id: index + 1, name, phone, email, address, created_at: ago(index * 9 + 2),
}));

const sales = Array.from({ length: 12 }, (_, index) => {
  const medicine = medicines[index % medicines.length];
  const batch = batches.find((item) => item.medicine_id === medicine.id);
  const quantity = (index % 3) + 1;
  const subtotal = medicine.selling_price * quantity;
  const discount = index % 4 === 0 ? 10 : 0;
  const tax = Math.round((subtotal - discount) * 0.05);
  return {
    id: index + 1, invoice_number: `INV-${String(301 + index).padStart(4, "0")}`, date: ago(index * 7 + 1),
    customer_id: index % 3 === 0 ? null : ((index % customers.length) + 1),
    customer: index % 3 === 0 ? null : customers[index % customers.length],
    payment_method: ["cash", "card", "upi"][index % 3], subtotal, discount, tax, total: subtotal - discount + tax,
    items: [{ medicine_id: medicine.id, medicine_name: medicine.name, batch_id: batch?.id, batch_number: batch?.batch_number ?? "—", quantity, price: medicine.selling_price }],
  };
});

export const demoData = { medicines, batches, customers, sales };
export const demoDates = { ago, fromNow };
