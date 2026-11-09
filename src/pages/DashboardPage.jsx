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


export function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data = {}, loading, error, load } = useLoader(async () => {
    const results = await Promise.allSettled([
      api.report("daily"), api.get("/api/inventory/low-stock"), api.expiring(30), api.customers(), api.sales(),
    ]);
    if (results.every((item) => item.status === "rejected")) {
      throw new Error(results[0].reason?.message || "Unable to load dashboard");
    }
    const get = (index) => results[index].status === "fulfilled" ? rowsOf(results[index].value) : [];
    const [daily, low, expiring, customers, sales] = [0, 1, 2, 3, 4].map(get);
    return { daily, low, expiring, customers, sales };
  });
  const dashboardData = data || {};
  useEffect(() => { if (dashboardData.customers) dispatch(setCustomers(dashboardData.customers)); }, [dashboardData.customers, dispatch]);
  const recent = (dashboardData.sales || []).slice(0, 5);
  const trend = (dashboardData.daily || []).slice(-14).map((row) => ({ day: new Date(row.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: Number(row.revenue || row.total || 0) }));
  return <><PageTitle title="Good morning" eyebrow="YOUR WORKSPACE"><Typography color="text.secondary" variant="body2">Here’s what’s happening at your store today.</Typography></PageTitle>
    {error && <Box sx={{ mb: 2 }}><ErrorState error={error} onRetry={load} /></Box>}
    <Box className="stats-grid">
      <StatCard title="Latest Day Revenue" value={dashboardData.daily?.slice(-1)[0]?.revenue || 0} currency icon={<TrendingUpRounded />} loading={loading} revealOnClick />
      <StatCard title="Low Stock Items" value={dashboardData.low?.length || 0} icon={<Inventory2Rounded />} color="blue" loading={loading} subtitle="Need to be restocked" />
      <StatCard title="Expiring in 30 Days" value={dashboardData.expiring?.length || 0} icon={<EventBusyRounded />} color="amber" loading={loading} subtitle="Review upcoming dates" revealOnClick />
      <StatCard title="Customers" value={dashboardData.customers?.length || 0} icon={<PeopleAltRounded />} color="green" loading={loading} subtitle="In your customer book" />
    </Box>
    <Stack direction="row" gap={1.2} sx={{ my: 2.5, flexWrap: "wrap" }}>
      <Button variant="contained" startIcon={<PointOfSaleRounded />} onClick={() => navigate("/new-sale")}>New Sale</Button>
      <Button variant="outlined" startIcon={<AddRounded />} onClick={() => navigate("/medicines/new")}>Add Medicine</Button>
      <Button variant="outlined" startIcon={<EventBusyRounded />} onClick={() => navigate("/expiry-alerts")}>Expiry Alerts</Button>
    </Stack>
    <Box className="dashboard-grid">
      <SectionCard title="Sales Trend" action={<Chip size="small" label="Last 14 days" variant="outlined" />} sx={{ gridColumn: { md: "span 7" } }}>
        {loading ? <Skeleton height={275} /> : trend.length ? <ResponsiveContainer width="100%" height={270}><AreaChart data={trend} margin={{ left: -18, right: 10, top: 10 }}>
          <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2484d8" stopOpacity={.25} /><stop offset="95%" stopColor="#2484d8" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8491a3", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8491a3", fontSize: 11 }} /><Tooltip formatter={(v) => formatMoney(v)} />
          <Area type="monotone" dataKey="revenue" stroke="#1976d2" strokeWidth={2.5} fill="url(#revenueFill)" /></AreaChart></ResponsiveContainer> : <EmptyState title="No sales data yet" subtitle="Complete a sale to see your revenue trend." />}
      </SectionCard>
      <SectionCard title="Recent Sales" action={<Button component={Link} to="/sales" size="small" endIcon={<ArrowForwardRounded />}>View all</Button>} sx={{ gridColumn: { md: "span 5" } }}>
        {loading ? <LoadingRows rows={5} /> : recent.length ? <Stack divider={<Divider flexItem />}>{recent.map((sale) => <Stack key={sale.id} direction="row" onClick={() => navigate(`/sales/${sale.id}`)} className="recent-sale" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Box><Typography fontWeight={700} variant="body2">{sale.invoice_number}</Typography><Typography variant="caption" color="text.secondary">{formatDate(sale.date)}</Typography></Box>
          <Typography fontWeight={750}>{formatMoney(sale.total)}</Typography></Stack>)}</Stack> : <EmptyState title="No sales recorded" />}
      </SectionCard>
    </Box>
  </>;
}
