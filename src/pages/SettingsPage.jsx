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

const defaultStoreSettings = {
  name: "MediStore Pharmacy", phone: "+91 98765 00000", email: "hello@medistore.in",
  currency: "INR", address: "12, Market Road, Bengaluru", taxRate: 5,
};

export function SettingsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({ ...defaultStoreSettings, ...JSON.parse(localStorage.getItem("medistore_settings") || "{}") }));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [databaseBusy, setDatabaseBusy] = useState(false);
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const desktopBridge = typeof window !== "undefined" ? window.medicalStore : undefined;
  useEffect(() => {
    let active = true;
    api.settings().then((settings) => {
      if (!active) return;
      setForm({ ...defaultStoreSettings, ...settings });
      localStorage.setItem("medistore_settings", JSON.stringify(settings));
    }).catch((exception) => {
      if (active) setError(exception.message || "Unable to load store settings.");
    });
    return () => { active = false; };
  }, []);
  async function save(event) {
    event.preventDefault();
    if (!form.name.trim()) { setError("Store name is required."); return; }
    if (!/^[A-Z]{3}$/.test(form.currency)) { setError("Enter a valid three-letter currency code, such as INR."); return; }
    if (!Number.isFinite(Number(form.taxRate)) || Number(form.taxRate) < 0) { setError("Tax rate must be a valid non-negative number."); return; }
    setBusy(true);
    try {
      const settings = await api.saveSettings({ ...form, taxRate: Number(form.taxRate) });
      setForm({ ...defaultStoreSettings, ...settings });
      localStorage.setItem("medistore_settings", JSON.stringify(settings));
      setError(""); setSuccess(true);
    } catch (e) { setError(e.message || "Unable to save settings"); }
    finally { setBusy(false); }
  }
  async function backupDatabase() {
    setDatabaseBusy(true); setDatabaseError(""); setDatabaseMessage("");
    try {
      const result = await desktopBridge.backupDatabase();
      if (!result.cancelled) setDatabaseMessage(`Database backup saved to ${result.path}`);
    } catch (exception) {
      setDatabaseError(exception.message || "Unable to back up the database.");
    } finally {
      setDatabaseBusy(false);
    }
  }
  async function restoreDatabase() {
    setDatabaseBusy(true); setDatabaseError(""); setDatabaseMessage("");
    try {
      const result = await desktopBridge.restoreDatabase();
      if (!result.cancelled) {
        setDatabaseMessage(`Database restored. Recovery copy saved to ${result.recoveryPath}`);
        window.location.reload();
      }
    } catch (exception) {
      setDatabaseError(exception.message || "Unable to restore the database.");
    } finally {
      setDatabaseBusy(false);
    }
  }
  return <><PageTitle title="Store settings" eyebrow="SYSTEM PREFERENCES"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/dashboard")}>Back</Button></PageTitle>
    <Card className="surface-card form-card"><CardContent><Typography variant="h6" fontWeight={730} sx={{ mb: 2.5 }}>Store Settings</Typography>
      {success && <Alert severity="success" onClose={() => setSuccess(false)} sx={{ mb: 2 }}>Settings saved. Your currency and store details are now up to date.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={save}><Box className="form-grid">
        <TextField label="Store Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="Currency Code" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} helperText="Three-letter code, e.g. INR" />
        <TextField label="Default Tax Rate (%)" type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
        <TextField label="Address" multiline minRows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} sx={{ gridColumn: "1 / -1" }} />
      </Box><Stack direction="row" gap={1} sx={{ mt: 3, justifyContent: "flex-end" }}><Button onClick={() => navigate("/dashboard")}>Cancel</Button><Button variant="contained" type="submit" disabled={busy}>{busy ? <CircularProgress size={19} /> : "Save Settings"}</Button></Stack></Box>
    </CardContent></Card>
    <Card className="surface-card form-card" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" fontWeight={730} sx={{ mb: 1 }}>Database backup and restore</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Backups are local SQLite files. Before restoring, MediStore validates the selected file and saves a recovery copy of the current database.
        </Typography>
        {databaseMessage && <Alert severity="success" sx={{ mb: 2 }}>{databaseMessage}</Alert>}
        {databaseError && <Alert severity="error" sx={{ mb: 2 }}>{databaseError}</Alert>}
        {!desktopBridge && <Alert severity="info" sx={{ mb: 2 }}>Database backup and restore are available in the Electron desktop app.</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
          <Button variant="outlined" disabled={!desktopBridge || databaseBusy} onClick={backupDatabase}>
            {databaseBusy ? <CircularProgress size={19} /> : "Back Up Database"}
          </Button>
          <Button variant="outlined" color="warning" disabled={!desktopBridge || databaseBusy} onClick={restoreDatabase}>
            Restore from Backup
          </Button>
        </Stack>
      </CardContent>
    </Card>
  </>;
}
