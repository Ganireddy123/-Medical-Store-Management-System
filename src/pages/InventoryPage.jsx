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


export function InventoryPage() {
  const { data, loading, error, load, setData } = useLoader(() => api.inventory());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState(null);
  const [batchError, setBatchError] = useState("");
  const [savingBatch, setSavingBatch] = useState(false);
  const rows = rowsOf(data).map((batch) => {
    const medicine = batch.medicine || {};
    return { ...batch, medicine, status: statusOf(batch, medicine.reorder_level) };
  });
  const filtered = rows.filter((row) => (filter === "All" || row.status === filter) &&
    `${row.medicine.name} ${row.batch_number}`.toLowerCase().includes(search.toLowerCase()));
  const filters = ["All", "Low Stock", "Expiring Soon", "Expired"];
  function openBatchEditor(batch) {
    setBatchError("");
    setEditingBatch(batch);
    setBatchForm({
      batch_number: batch.batch_number,
      expiry_date: String(batch.expiry_date).slice(0, 10),
      buying_price: String(batch.purchase_price ?? batch.buying_price ?? 0),
      selling_price: String(batch.selling_price ?? 0),
      quantity: String(batch.quantity),
    });
  }
  async function saveBatch(event) {
    event.preventDefault();
    if (!editingBatch || savingBatch) return;
    setSavingBatch(true);
    setBatchError("");
    try {
      const updated = await api.updateBatch(editingBatch.id, {
        ...batchForm,
        buying_price: Number(batchForm.buying_price),
        selling_price: Number(batchForm.selling_price),
        quantity: Number(batchForm.quantity),
      });
      setData((current) => rowsOf(current).map((batch) => batch.id === updated.id
        ? { ...batch, ...updated, buying_price: updated.purchase_price, medicine: batch.medicine }
        : batch));
      setEditingBatch(null);
      setBatchForm(null);
    } catch (e) {
      setBatchError(e.message || "Unable to update batch.");
    } finally {
      setSavingBatch(false);
    }
  }
  return <><PageTitle title="Stock overview" eyebrow="INVENTORY"><Button variant="outlined" startIcon={<EventBusyRounded />} component={Link} to="/expiry-alerts">Expiry alerts</Button></PageTitle>
    <Paper variant="outlined" className="filter-bar"><SearchBox value={search} onChange={setSearch} placeholder="Search by medicine or batch..." />
      <Stack direction="row" gap={.8} sx={{ flexWrap: "wrap" }}>{filters.map((name) => <Button size="small" key={name} variant={filter === name ? "contained" : "outlined"} onClick={() => setFilter(name)}>{name} <Box component="span" sx={{ ml: .7, opacity: .72 }}>{name === "All" ? rows.length : rows.filter((row) => row.status === name).length}</Box></Button>)}</Stack>
    </Paper>
    <DataTable rows={filtered} loading={loading} error={error} retry={load} columns={[
      { key: "medicine", label: "Medicine", render: (row) => <Typography fontWeight={650}>{row.medicine.name || "—"}</Typography> },
      { key: "batch_number", label: "Batch" }, { key: "expiry_date", label: "Expiry", render: (row) => formatDate(row.expiry_date) },
      { key: "quantity", label: "Quantity", align: "right", render: (row) => <Typography fontWeight={700}>{row.quantity}</Typography> },
      { key: "selling_price", label: "Price", align: "right", render: (row) => formatMoney(row.selling_price) },
      { key: "status", label: "Status", render: (row) => <StatusChip status={row.status} /> },
      { key: "actions", label: "Actions", align: "right", render: (row) => <IconButton size="small" aria-label={`Edit batch ${row.batch_number}`} onClick={() => openBatchEditor(row)}><EditRounded fontSize="small" /></IconButton> },
    ]} />
    <Dialog open={Boolean(editingBatch)} onClose={() => { if (!savingBatch) { setEditingBatch(null); setBatchForm(null); } }} fullWidth maxWidth="sm">
      <DialogTitle>Edit Batch — {editingBatch?.medicine?.name}</DialogTitle>
      <Box component="form" onSubmit={saveBatch}>
        <DialogContent dividers>
          {batchError && <Alert severity="error" sx={{ mb: 2 }}>{batchError}</Alert>}
          {batchForm && <Box className="form-grid">
            <TextField required label="Batch Number" value={batchForm.batch_number} onChange={(event) => setBatchForm({ ...batchForm, batch_number: event.target.value })} />
            <TextField required type="date" label="Expiry Date" slotProps={{ inputLabel: { shrink: true } }} value={batchForm.expiry_date} onChange={(event) => setBatchForm({ ...batchForm, expiry_date: event.target.value })} />
            <TextField required type="number" label="Quantity" slotProps={{ htmlInput: { min: 0, step: 1 } }} value={batchForm.quantity} onChange={(event) => setBatchForm({ ...batchForm, quantity: event.target.value })} />
            <TextField required type="number" label="Purchase Price (₹)" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={batchForm.buying_price} onChange={(event) => setBatchForm({ ...batchForm, buying_price: event.target.value })} />
            <TextField required type="number" label="Selling Price (₹)" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={batchForm.selling_price} onChange={(event) => setBatchForm({ ...batchForm, selling_price: event.target.value })} />
          </Box>}
        </DialogContent>
        <DialogActions>
          <Button disabled={savingBatch} onClick={() => { setEditingBatch(null); setBatchForm(null); }}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={savingBatch}>{savingBatch ? <CircularProgress size={19} /> : "Save Changes"}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  </>;
}
