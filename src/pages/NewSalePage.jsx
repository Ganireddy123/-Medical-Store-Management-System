/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel,
  IconButton, InputAdornment, InputLabel,
  LinearProgress, MenuItem, Paper, Select, Skeleton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import EventBusyRounded from "@mui/icons-material/EventBusyRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import PointOfSaleRounded from "@mui/icons-material/PointOfSaleRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import AddCircleOutlineRounded from "@mui/icons-material/AddCircleOutlineRounded";
import PrintRounded from "@mui/icons-material/PrintRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import LocalPharmacyRounded from "@mui/icons-material/LocalPharmacyRounded";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { api, daysUntil, formatDate, formatMoney, statusOf } from "../API/context";
import {
  addManualItem, addMedicine, clearCart, removeManualItem, removeMedicine,
  setCartField, setCustomers, setManualQuantity, setMedicines, setMedicineQuantity,
} from "../store";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, LoadingRows, PageTitle, StatCard } from "../components/common";

import { useLoader, rowsOf, SearchBox, DataTable, StatusChip, SectionCard, DetailLine, TotalLine, emptyCustomer, validateCustomer } from "./PageShared";

const emptyManualForm = () => ({
  name: "", generic_name: "", manufacturer: "", batch_number: "", expiry_date: "",
  quantity: "1", unit: "piece", price: "", is_otc: false,
});

export function NewSalePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector((state) => state.cart);
  const customers = useSelector((state) => state.customer.items);
  const medicines = useSelector((state) => state.medicine.items);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addingMedicineId, setAddingMedicineId] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualFormError, setManualFormError] = useState("");
  const [error, setError] = useState("");
  const [draftStorageError, setDraftStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!customers.length) api.customers().then((data) => dispatch(setCustomers(data))).catch((e) => setError(e.message));
    if (!medicines.length) api.medicines().then((data) => dispatch(setMedicines(data))).catch((e) => setError(e.message));
  }, [customers.length, medicines.length, dispatch]);
  useEffect(() => {
    if (!cart.items.length) {
      let savedTaxRate;
      try { savedTaxRate = JSON.parse(localStorage.getItem("medistore_settings") || "{}").taxRate; }
      catch { savedTaxRate = undefined; }
      if (savedTaxRate !== undefined) dispatch(setCartField({ field: "taxRate", value: savedTaxRate }));
    }
  }, [cart.items.length, dispatch]);
  const results = useMemo(() => medicines.filter((medicine) => `${medicine.name} ${medicine.strength} ${medicine.generic_name} ${medicine.manufacturer}`.toLowerCase().includes(debouncedQuery.toLowerCase())), [medicines, debouncedQuery]);
  const matchingMedicine = useMemo(() => {
    const normalizedName = manualForm.name.trim().toLocaleLowerCase();
    return normalizedName ? medicines.find((medicine) =>
      medicine.name.trim().toLocaleLowerCase() === normalizedName ||
      medicine.generic_name?.trim().toLocaleLowerCase() === normalizedName) : null;
  }, [manualForm.name, medicines]);
  const matchingHasEligibleBatch = Boolean(matchingMedicine && (
    Number.isFinite(Number(matchingMedicine.available_stock))
      ? Number(matchingMedicine.available_stock) > 0
      : (matchingMedicine.batches || []).some((batch) => {
        const expiryDate = String(batch.expiry_date || "").slice(0, 10);
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return Number(batch.quantity ?? batch.stock) > 0 &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || expiryDate >= today);
      })
  ));
  const itemTotal = (item) => item.is_manual_item
    ? Math.round(Number(item.price) * Number(item.quantity) * 100) / 100
    : item.allocations.reduce((sum, batch) =>
      sum + Math.round(Number(batch.selling_price) * batch.quantity * 100) / 100, 0);
  const subtotal = Math.round(cart.items.reduce((sum, item) => sum + itemTotal(item), 0) * 100) / 100;
  const discount = Math.min(subtotal, Math.max(0, Number(cart.discount || 0)));
  const tax = Math.round(Math.max(0, subtotal - discount) * Math.max(0, Number(cart.taxRate || 0)) / 100);
  const total = subtotal - discount + tax;
  useEffect(() => {
    const onDraftStorageError = (event) => setDraftStorageError(event.detail);
    window.addEventListener("medistore:draft-storage-error", onDraftStorageError);
    return () => window.removeEventListener("medistore:draft-storage-error", onDraftStorageError);
  }, []);
  async function chooseMedicine(medicine) {
    if (addingMedicineId != null) return;
    setAddingMedicineId(medicine.id);
    setError("");
    try {
      const batches = rowsOf(await api.batches(medicine.id));
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const availableBatches = batches.filter((candidate) => {
        const expiryDate = String(candidate.expiry_date || "").slice(0, 10);
        return Number(candidate.quantity ?? candidate.stock) > 0 &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || expiryDate >= today);
      });
      if (!availableBatches.length) {
        setError(`No eligible batch is available for ${medicine.name}. Receive or manage stock in Inventory before selling it.`);
        return;
      }
      dispatch(addMedicine({
        medicine,
        batches: availableBatches.map((batch) => ({
          id: batch.id,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
          selling_price: Number(batch.selling_price ?? medicine.selling_price ?? 0),
          quantity: Number(batch.quantity ?? batch.stock),
        })),
      }));
    } catch (e) {
      setError(e.message || `Unable to add ${medicine.name}.`);
    } finally {
      setAddingMedicineId(null);
    }
  }
  function openManualDialog() {
    setManualForm(emptyManualForm());
    setManualFormError("");
    setManualOpen(true);
  }
  function addManualLine() {
    setManualFormError("");
    const name = manualForm.name.trim();
    const quantity = Number(manualForm.quantity);
    const price = Number(manualForm.price);
    if (!name) return setManualFormError("Medicine name is required.");
    if (!manualForm.unit.trim()) return setManualFormError("Unit is required.");
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return setManualFormError("Quantity must be a positive whole number.");
    if (!Number.isFinite(price) || price <= 0) return setManualFormError("Selling price must be greater than zero.");
    if (!manualForm.is_otc) return setManualFormError("Confirm this item does not require a prescription or regulated record.");
    if (matchingMedicine) return setManualFormError(
      `${matchingMedicine.name} is registered in inventory. ${Number(matchingMedicine.available_stock) > 0
        ? "Add it from the catalog using an eligible batch."
        : "No eligible batch is available; receive or manage stock before selling it."}`,
    );
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dispatch(addManualItem({
      manual_id: `manual-${randomId}`,
      name,
      generic_name: manualForm.generic_name.trim(),
      manufacturer: manualForm.manufacturer.trim(),
      batch_number: manualForm.batch_number.trim(),
      expiry_date: manualForm.expiry_date,
      unit: manualForm.unit.trim(),
      quantity,
      price,
      is_otc: true,
    }));
    setManualOpen(false);
    setManualForm(emptyManualForm());
  }
  async function completeSale() {
    setBusy(true); setError("");
    try {
      const sale = await api.createSale({
        customer_id: cart.customerId || null,
        items: cart.items.flatMap((item) => item.is_manual_item
          ? [{
            is_manual_item: true,
            is_otc: item.is_otc,
            name: item.name,
            generic_name: item.generic_name,
            manufacturer: item.manufacturer,
            batch_number: item.batch_number,
            expiry_date: item.expiry_date,
            unit: item.unit,
            quantity: item.quantity,
            price: item.price,
          }]
          : item.allocations.map((batch) => ({
            medicine_id: item.medicine_id,
            batch_id: batch.id,
            quantity: batch.quantity,
            price: batch.selling_price,
          }))),
        discount, tax_rate: Math.max(0, Number(cart.taxRate || 0)), payment_method: cart.payment,
      });
      dispatch(clearCart()); navigate(`/invoice/${sale.id}`);
    } catch (e) { setError(e.message || "Unable to complete sale"); }
    finally { setBusy(false); }
  }
  return <><PageTitle title="New Sale" eyebrow="POINT OF SALE"><Typography color="text.secondary" variant="body2">Find products and prepare an invoice.</Typography></PageTitle>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
    {cart.draftLoadError && <Alert severity="warning" sx={{ mb: 2 }}>The saved sale could not be restored: {cart.draftLoadError}</Alert>}
    {draftStorageError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDraftStorageError("")}>{draftStorageError}</Alert>}
    {cart.draftRestored && <Alert severity="info" sx={{ mb: 2 }}>Your unfinished sale was restored. Continue where you left off, or clear the cart to discard it.</Alert>}
    <Box className="sale-grid">
      <SectionCard title="Add medicines" action={<Chip size="small" variant="outlined" label="Search catalog" />}>
        <TextField fullWidth size="small" placeholder="Search medicines by name, strength..." value={query} onChange={(e) => setQuery(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
        <Button variant="outlined" size="small" sx={{ mt: 1.5 }} onClick={openManualDialog}>Medicine Not Found? Add Manually</Button>
        <Stack sx={{ mt: 2 }} divider={<Divider flexItem />}>
          {results.length ? results.map((medicine) => <Stack key={medicine.id} direction="row" gap={1} sx={{ justifyContent: "space-between", alignItems: "center", py: 1.3 }}>
              <Box sx={{ minWidth: 0 }}><Typography fontWeight={700} noWrap>{medicine.name} <Typography component="span" variant="body2" color="text.secondary">{medicine.strength}</Typography></Typography>
                <Typography variant="caption" color="text.secondary">{medicine.manufacturer} · {medicine.category || "Medicine"} · {formatMoney(medicine.selling_price)}</Typography></Box>
              <IconButton color="primary" disabled={addingMedicineId != null} onClick={() => chooseMedicine(medicine)} aria-label={`Add ${medicine.name} to sale`}>
                {addingMedicineId === medicine.id ? <CircularProgress size={22} /> : <AddCircleOutlineRounded />}
              </IconButton>
            </Stack>) : <EmptyState title="No medicines found" subtitle={debouncedQuery ? "Try searching with another name." : "Add medicines to your catalog to see them here."} />}
        </Stack>
      </SectionCard>
      <SectionCard title={`Cart (${cart.items.length} items)`} action={Boolean(cart.items.length) && <Button size="small" color="error" onClick={() => dispatch(clearCart())}>Clear</Button>}>
        {cart.items.length === 0 ? <EmptyState title="Your cart is empty" subtitle="Search and add medicines to get started." /> : <>
          <Stack divider={<Divider flexItem />} sx={{ mb: 2 }}>{cart.items.map((item) => <Stack key={item.is_manual_item ? item.manual_id : item.medicine_id} direction="row" gap={1} sx={{ alignItems: "center", py: 1.1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" gap={0.75} sx={{ alignItems: "center" }}><Typography fontWeight={700} variant="body2" noWrap>{item.name}</Typography>{item.is_manual_item && <Chip size="small" label="Manual Item" color="warning" variant="outlined" />}</Stack>
              <Typography variant="caption" color="text.secondary">{item.is_manual_item ? `${item.quantity} ${item.unit} · ${formatMoney(item.price)} each · ` : ""}{formatMoney(itemTotal(item))} total</Typography></Box>
            <IconButton size="small" aria-label="Decrease quantity" disabled={item.quantity <= 1} onClick={() => item.is_manual_item
              ? dispatch(setManualQuantity({ id: item.manual_id, quantity: item.quantity - 1 }))
              : dispatch(setMedicineQuantity({ id: item.medicine_id, quantity: item.quantity - 1 }))}><RemoveRounded fontSize="small" /></IconButton>
            <Typography variant="body2" fontWeight={700}>{item.quantity}</Typography>
            <IconButton size="small" aria-label="Increase quantity" disabled={!item.is_manual_item && item.quantity >= item.stock} onClick={() => item.is_manual_item
              ? dispatch(setManualQuantity({ id: item.manual_id, quantity: item.quantity + 1 }))
              : dispatch(setMedicineQuantity({ id: item.medicine_id, quantity: item.quantity + 1 }))}><AddRounded fontSize="small" /></IconButton>
            <IconButton size="small" color="error" aria-label="Remove item" onClick={() => item.is_manual_item
              ? dispatch(removeManualItem(item.manual_id))
              : dispatch(removeMedicine(item.medicine_id))}><DeleteOutlineRounded fontSize="small" /></IconButton>
          </Stack>)}</Stack>
          <Box className="cart-fields">
            <FormControl size="small" fullWidth><InputLabel>Customer</InputLabel><Select label="Customer" value={cart.customerId} onChange={(e) => dispatch(setCartField({ field: "customerId", value: e.target.value }))}>
              <MenuItem value="">Walk-in Customer</MenuItem>{customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}
            </Select></FormControl>
            <FormControl size="small" fullWidth><InputLabel>Payment Method</InputLabel><Select label="Payment Method" value={cart.payment} onChange={(e) => dispatch(setCartField({ field: "payment", value: e.target.value }))}>
              {["cash", "card", "upi"].map((payment) => <MenuItem key={payment} value={payment}>{payment.toUpperCase()}</MenuItem>)}
            </Select></FormControl>
            <TextField size="small" label="Discount (₹)" type="number" slotProps={{ htmlInput: { min: 0, max: subtotal } }} value={cart.discount} onChange={(e) => dispatch(setCartField({ field: "discount", value: e.target.value }))} />
            <TextField size="small" label="Tax Rate (%)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={cart.taxRate} onChange={(e) => dispatch(setCartField({ field: "taxRate", value: e.target.value }))} />
          </Box>
          <Stack spacing={1} sx={{ mt: 2 }}>
          <TotalLine label="Subtotal" value={subtotal} /><TotalLine label="Tax" value={tax} /><TotalLine label="Discount (−)" value={-discount} />
            <Divider /><TotalLine label="Total" value={total} strong />
          </Stack>
          <Button fullWidth variant="contained" size="large" disabled={!cart.items.length || busy} onClick={completeSale} sx={{ mt: 2.5 }}>{busy ? <CircularProgress size={20} color="inherit" /> : "Save Sale & View Invoice"}</Button>
        </>}
      </SectionCard>
    </Box>
    <Dialog open={manualOpen} onClose={() => setManualOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Add a medicine manually</DialogTitle>
      <DialogContent>
        {matchingMedicine && <Alert severity="error" sx={{ mb: 2 }}>
          {matchingMedicine.name} is already registered. {matchingHasEligibleBatch
            ? "Use the catalog and select an eligible batch."
            : "No eligible batch is available. Receive or manage its stock before selling it; it cannot be added as a manual item."}
        </Alert>}
        {manualFormError && <Alert severity="error" sx={{ mb: 2 }}>{manualFormError}</Alert>}
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <TextField autoFocus required label="Medicine name" value={manualForm.name}
            onChange={(event) => setManualForm({ ...manualForm, name: event.target.value })} />
          <TextField label="Generic name (optional)" value={manualForm.generic_name}
            onChange={(event) => setManualForm({ ...manualForm, generic_name: event.target.value })} />
          <TextField label="Manufacturer (optional)" value={manualForm.manufacturer}
            onChange={(event) => setManualForm({ ...manualForm, manufacturer: event.target.value })} />
          <TextField label="Batch number (optional)" value={manualForm.batch_number}
            onChange={(event) => setManualForm({ ...manualForm, batch_number: event.target.value })} />
          <TextField label="Expiry date (optional)" type="date" value={manualForm.expiry_date}
            onChange={(event) => setManualForm({ ...manualForm, expiry_date: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField required fullWidth label="Quantity" type="number" value={manualForm.quantity}
              onChange={(event) => setManualForm({ ...manualForm, quantity: event.target.value })}
              slotProps={{ htmlInput: { min: 1, step: 1 } }} />
            <TextField required fullWidth label="Unit" placeholder="tablet, capsule, strip, bottle..." value={manualForm.unit}
              onChange={(event) => setManualForm({ ...manualForm, unit: event.target.value })} />
            <TextField required fullWidth label="Selling price per unit (₹)" type="number" value={manualForm.price}
              onChange={(event) => setManualForm({ ...manualForm, price: event.target.value })}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }} />
          </Stack>
          <Typography variant="body2" fontWeight={700}>
            Line total: {formatMoney(
              Number.isSafeInteger(Number(manualForm.quantity)) && Number(manualForm.quantity) > 0 &&
              Number.isFinite(Number(manualForm.price)) && Number(manualForm.price) > 0
                ? Number(manualForm.quantity) * Number(manualForm.price)
                : 0,
            )}
          </Typography>
          <FormControlLabel control={<Checkbox checked={manualForm.is_otc}
            onChange={(event) => setManualForm({ ...manualForm, is_otc: event.target.checked })} />}
            label="I confirm this item does not require a prescription or other regulated record." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setManualOpen(false)}>Cancel</Button>
        {matchingMedicine && matchingHasEligibleBatch && <Button onClick={() => {
          setQuery(matchingMedicine.name);
          setManualOpen(false);
        }}>Use Catalog</Button>}
        {matchingMedicine && !matchingHasEligibleBatch && <Button onClick={() => {
          setManualOpen(false);
          navigate("/inventory");
        }}>Go to Inventory</Button>}
        <Button variant="contained" onClick={addManualLine} disabled={Boolean(matchingMedicine)}>Add to Current Bill</Button>
      </DialogActions>
    </Dialog>
  </>;
}
