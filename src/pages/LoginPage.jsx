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


export function LoginScreen() {
  const { login, demoLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "admin@medistore.in", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => { if (isAuthenticated) navigate("/dashboard", { replace: true }); }, [isAuthenticated, navigate]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await login(form.email, form.password); navigate("/dashboard", { replace: true }); }
    catch (exception) { setError(exception.response?.data?.message || exception.message || "Unable to sign in. Check your details and try again."); }
    finally { setBusy(false); }
  }
  return <Box className="login-page"><Card className="login-card"><CardContent>
    <Box className="login-brand-icon"><LocalPharmacyRounded /></Box>
    <Typography variant="h4" fontWeight={800} sx={{ textAlign: "center", letterSpacing: "-.04em" }}>MediStore</Typography>
    <Typography color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>Medical Store Management</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box component="form" onSubmit={submit} noValidate>
      <TextField fullWidth label="Email address" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} sx={{ mb: 2 }} />
      <TextField fullWidth label="Password" required type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
        slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</IconButton></InputAdornment> } }} sx={{ mb: 2.5 }} />
      <Button fullWidth variant="contained" type="submit" disabled={busy} size="large">{busy ? <><CircularProgress size={18} sx={{ mr: 1 }} />Logging in...</> : "Sign in"}</Button>
    </Box>
    <Divider sx={{ my: 2.5 }}>or</Divider>
    <Button fullWidth variant="outlined" size="large" onClick={() => { demoLogin(); navigate("/dashboard", { replace: true }); }}>Continue offline</Button>
    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>Works without internet. Your pharmacy data stays on this device.</Typography>
  </CardContent></Card></Box>;
}
