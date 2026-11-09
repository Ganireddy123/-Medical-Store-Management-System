/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, IconButton, InputAdornment, InputLabel,
  LinearProgress, MenuItem, Paper, Select, Skeleton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import MedicationRounded from "@mui/icons-material/MedicationRounded";
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
import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { api, daysUntil, formatDate, formatMoney, statusOf } from "../API/context";
import { addItem, clearCart, removeItem, setCartField, setCustomers, setMedicines, setQuantity } from "../store";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, LoadingRows, PageTitle, StatCard } from "../components/common";

import { useLoader, rowsOf, SearchBox, DataTable, StatusChip, SectionCard, DetailLine, TotalLine, emptyCustomer, validateCustomer } from "./PageShared";

const blankMedicine = {
  name: "", generic_name: "", strength: "", manufacturer: "", category: "",
  reorder_level: 10, selling_price: "", buying_price: "", description: "",
};
const blankInitialBatch = { batch_number: "", expiry_date: "", buying_price: "", selling_price: "", quantity: "" };

export function MedicineForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const medicines = useSelector((state) => state.medicine.items);
  const editing = Boolean(id);
  const [form, setForm] = useState(blankMedicine);
  const [initialBatch, setInitialBatch] = useState(blankInitialBatch);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!editing) return;
    api.medicine(id).then((data) => setForm({ ...blankMedicine, ...data })).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [id, editing]);
  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Medicine name is required.";
    if (form.selling_price === "" || !Number.isFinite(Number(form.selling_price)) || Number(form.selling_price) < 0) next.selling_price = "Enter a valid non-negative price.";
    if (!editing) {
      if (!initialBatch.batch_number.trim()) next.batch_number = "Batch number is required.";
      if (!initialBatch.expiry_date) next.expiry_date = "Expiry date is required.";
      if (initialBatch.quantity === "" || !Number.isSafeInteger(Number(initialBatch.quantity)) || Number(initialBatch.quantity) <= 0) {
        next.quantity = "Enter an opening quantity greater than zero.";
      }
      for (const field of ["buying_price", "selling_price"]) {
        const value = initialBatch[field] === "" ? form[field] : initialBatch[field];
        if (!Number.isFinite(Number(value)) || Number(value) < 0) next[field] = "Enter a valid non-negative price.";
      }
    }
    setFieldError(next); return !Object.keys(next).length;
  }
  async function submit(event) {
    event.preventDefault(); if (!validate()) return;
    setBusy(true); setError("");
    try {
      const medicineData = {
        ...form,
        selling_price: Number(form.selling_price),
        buying_price: form.buying_price === "" ? null : Number(form.buying_price),
        reorder_level: form.reorder_level === "" ? null : Number(form.reorder_level),
      };
      if (!editing) {
        medicineData.initial_batch = {
          ...initialBatch,
          buying_price: Number(initialBatch.buying_price === "" ? form.buying_price || 0 : initialBatch.buying_price),
          selling_price: Number(initialBatch.selling_price === "" ? form.selling_price : initialBatch.selling_price),
          quantity: Number(initialBatch.quantity),
        };
      }
      const saved = await api.saveMedicine(medicineData, id);
      dispatch(setMedicines([saved, ...medicines.filter((medicine) => medicine.id !== saved.id)]));
      navigate("/medicines");
    } catch (e) { setError(e.message || "Unable to save medicine"); } finally { setBusy(false); }
  }
  return <><PageTitle title={editing ? "Edit Medicine" : "Add Medicine"} eyebrow="PRODUCT CATALOG"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/medicines")}>Back</Button></PageTitle>
    {loading ? <Skeleton variant="rounded" height={520} /> : <Card className="surface-card form-card"><CardContent>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography variant="h6" fontWeight={730} sx={{ mb: 2.5 }}>Medicine information</Typography>
      <Box component="form" onSubmit={submit}><Box className="form-grid">
        <TextField label="Medicine Name *" value={form.name} error={Boolean(fieldError.name)} helperText={fieldError.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Generic Name" value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
        <TextField label="Strength" placeholder="500mg" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} />
        <TextField label="Manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
        <TextField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <TextField label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
        <TextField label="Selling Price (₹) *" type="number" value={form.selling_price} error={Boolean(fieldError.selling_price)} helperText={fieldError.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
        <TextField label="Buying Price (₹)" type="number" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} />
        <TextField label="Description" multiline minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} sx={{ gridColumn: "1 / -1" }} />
      </Box>
      {!editing && <><Divider sx={{ my: 3 }} /><Typography variant="h6" fontWeight={730} sx={{ mb: 0.5 }}>Opening batch &amp; stock</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Add the first batch now. Medicine and batch will be saved together.</Typography>
        <Box className="form-grid">
          <TextField required label="Batch Number *" value={initialBatch.batch_number} error={Boolean(fieldError.batch_number)} helperText={fieldError.batch_number} onChange={(e) => setInitialBatch({ ...initialBatch, batch_number: e.target.value })} />
          <TextField required type="date" label="Expiry Date *" slotProps={{ inputLabel: { shrink: true } }} value={initialBatch.expiry_date} error={Boolean(fieldError.expiry_date)} helperText={fieldError.expiry_date} onChange={(e) => setInitialBatch({ ...initialBatch, expiry_date: e.target.value })} />
          <TextField required type="number" label="Opening Quantity *" slotProps={{ htmlInput: { min: 1, step: 1 } }} value={initialBatch.quantity} error={Boolean(fieldError.quantity)} helperText={fieldError.quantity} onChange={(e) => setInitialBatch({ ...initialBatch, quantity: e.target.value })} />
          <TextField type="number" label="Batch Purchase Price (₹)" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={initialBatch.buying_price} error={Boolean(fieldError.buying_price)} helperText={fieldError.buying_price || `Defaults to medicine buying price${form.buying_price ? ` (${form.buying_price})` : " (₹0)"}.`} onChange={(e) => setInitialBatch({ ...initialBatch, buying_price: e.target.value })} />
          <TextField type="number" label="Batch Selling Price (₹)" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={initialBatch.selling_price} error={Boolean(fieldError.selling_price)} helperText={fieldError.selling_price || `Defaults to medicine selling price${form.selling_price ? ` (${form.selling_price})` : ""}.`} onChange={(e) => setInitialBatch({ ...initialBatch, selling_price: e.target.value })} />
        </Box>
      </>}
      <Stack direction="row" gap={1.2} sx={{ mt: 3, justifyContent: "flex-end" }}><Button onClick={() => navigate("/medicines")}>Cancel</Button><Button variant="contained" type="submit" disabled={busy}>{busy ? <CircularProgress size={19} /> : editing ? "Save Changes" : "Save Medicine & Batch"}</Button></Stack></Box>
    </CardContent></Card>}
  </>;
}
