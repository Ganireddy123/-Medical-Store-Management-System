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

export function CustomerDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const customers = useSelector((state) => state.customer.items);
  const { data: customer, loading, error, load, setData } = useLoader(() => api.customer(id), [id]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  function openEdit() { setForm({ ...emptyCustomer, ...customer }); setErrors({}); setSaveError(""); setEditing(true); }
  async function saveChanges() {
    const validation = validateCustomer(form); setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true); setSaveError("");
    try {
      const updated = await api.saveCustomer(form, id);
      setData(updated);
      dispatch(setCustomers([updated, ...customers.filter((item) => item.id !== updated.id)]));
      setEditing(false);
    }
    catch (e) { setSaveError(e.message || "Unable to update customer"); }
    finally { setBusy(false); }
  }
  return <><PageTitle title="Customer details" eyebrow="CUSTOMER BOOK"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/customers")}>Back to Customers</Button></PageTitle>
    {loading ? <Skeleton variant="rounded" height={360} /> : error ? <Stack spacing={2}><ErrorState error={error} onRetry={load} /><Button sx={{ alignSelf: "flex-start" }} onClick={() => navigate("/customers")}>Back to Customers</Button></Stack> : !customer ? <Alert severity="warning">Customer not found.</Alert> :
      <Card className="surface-card detail-card"><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack direction="row" gap={2} sx={{ mb: 3, alignItems: "center" }}><Avatar sx={{ width: 58, height: 58, bgcolor: "primary.light" }}><PersonOutlineRounded fontSize="large" /></Avatar>
          <Box sx={{ flex: 1 }}><Typography variant="h5" fontWeight={780}>{customer.name}</Typography><Typography color="text.secondary">Customer</Typography></Box><Button variant="outlined" startIcon={<EditRounded />} onClick={openEdit}>Edit</Button></Stack>
        <Divider sx={{ mb: 2 }} /><DetailLine label="Phone" value={customer.phone} /><DetailLine label="Email" value={customer.email} /><DetailLine label="Address" value={customer.address} /><DetailLine label="Added on" value={formatDate(customer.created_at)} />
      </CardContent></Card>}
    <Dialog open={editing} onClose={() => setEditing(false)} fullWidth maxWidth="sm"><DialogTitle>Edit Customer</DialogTitle><DialogContent>
      {saveError && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{saveError}</Alert>}
      <Stack spacing={2} sx={{ pt: 1 }}><TextField label="Full Name *" value={form.name} error={Boolean(errors.name)} helperText={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Phone *" value={form.phone} error={Boolean(errors.phone)} helperText={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <TextField label="Email" value={form.email} error={Boolean(errors.email)} helperText={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Address" multiline minRows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Stack>
    </DialogContent><DialogActions><Button onClick={() => setEditing(false)}>Cancel</Button><Button variant="contained" disabled={busy} onClick={saveChanges}>{busy ? <CircularProgress size={19} /> : "Save Changes"}</Button></DialogActions></Dialog>
  </>;
}
