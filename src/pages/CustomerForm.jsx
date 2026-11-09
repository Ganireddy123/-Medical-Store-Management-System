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


export function CustomerForm() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const customers = useSelector((state) => state.customer.items);
  const [form, setForm] = useState(emptyCustomer);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const validation = validateCustomer(form); setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true); setError("");
    try {
      const customer = await api.saveCustomer(form);
      dispatch(setCustomers([customer, ...customers.filter((item) => item.id !== customer.id)]));
      navigate(`/customers/${customer.id}`);
    } catch (e) { setError(e.message || "Unable to save customer"); }
    finally { setBusy(false); }
  }
  return <><PageTitle title="Add Customer" eyebrow="CUSTOMER BOOK"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/customers")}>Back</Button></PageTitle>
    <Card className="surface-card form-card narrow-card"><CardContent><Typography variant="h6" fontWeight={730} sx={{ mb: 2.5 }}>Customer Information</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={submit}><Stack spacing={2}>
        <TextField label="Full Name *" value={form.name} error={Boolean(errors.name)} helperText={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Phone *" value={form.phone} error={Boolean(errors.phone)} helperText={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <TextField label="Email" value={form.email} error={Boolean(errors.email)} helperText={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Address" multiline minRows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Stack><Stack direction="row" gap={1} sx={{ mt: 3, justifyContent: "flex-end" }}><Button onClick={() => navigate("/customers")}>Cancel</Button><Button variant="contained" type="submit" disabled={busy}>{busy ? <CircularProgress size={19} /> : "Save Customer"}</Button></Stack></Box>
    </CardContent></Card>
  </>;
}
