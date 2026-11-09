/* eslint-disable no-unused-vars, react-refresh/only-export-components */
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

export function useLoader(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setData(await loader()); } catch (exception) { setError(exception.message || "Unable to load data"); }
    finally { setLoading(false); }
  };
  const dependencyKey = JSON.stringify(dependencies);
  // The callers provide the specific changing values in `dependencies`.
  // Queueing avoids a synchronous loading-state update during effect execution.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { Promise.resolve().then(load); }, [dependencyKey]);
  return { data, loading, error, load, setData };
}
export const rowsOf = (data) => Array.isArray(data) ? data : data ? [data] : [];
export function SearchBox({ value, onChange, placeholder }) {
  return <TextField size="small" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }}
    sx={{ width: { xs: "100%", sm: 340 }, bgcolor: "#fff" }} />;
}
export function DataTable({ columns, rows, loading, error, retry, emptyTitle, emptySubtitle, onRowClick, rowsPerPage = 10, pagination = true }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(rowsPerPage);
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    return [...rows].sort((left, right) => {
      const a = left[sort.key] ?? "";
      const b = right[sort.key] ?? "";
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [rows, sort]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(sortedRows.length / size) - 1));
  const visible = pagination ? sortedRows.slice(safePage * size, (safePage + 1) * size) : sortedRows;
  return <Paper variant="outlined" className="table-card">
    {error ? <Box sx={{ p: 2 }}><ErrorState error={error} onRetry={retry} /></Box> : loading ? <Box sx={{ p: 2 }}><LoadingRows rows={5} columns={columns.length} /></Box> :
      !rows.length ? <EmptyState title={emptyTitle || "No records found"} subtitle={emptySubtitle || "Try adjusting your search or add a new record."} /> :
        <>
          <TableContainer><Table size="medium"><TableHead><TableRow>{columns.map((column) => <TableCell key={column.key} align={column.align || "left"}>
            {column.sortKey ? <TableSortLabel active={sort.key === column.sortKey} direction={sort.key === column.sortKey ? sort.direction : "asc"} onClick={() => setSort((current) => ({
              key: column.sortKey, direction: current.key === column.sortKey && current.direction === "asc" ? "desc" : "asc",
            }))}>{column.label}</TableSortLabel> : column.label}
          </TableCell>)}</TableRow></TableHead>
            <TableBody>{visible.map((row) => <TableRow key={row.id} hover onClick={() => onRowClick?.(row)} sx={onRowClick ? { cursor: "pointer" } : undefined}>
              {columns.map((column) => <TableCell key={column.key} align={column.align || "left"}>{column.render ? column.render(row) : row[column.key] ?? "—"}</TableCell>)}
            </TableRow>)}</TableBody>
          </Table></TableContainer>
          {pagination && <TablePagination component="div" count={sortedRows.length} page={safePage} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50]}
            onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} />}
        </>}
  </Paper>;
}
export function StatusChip({ status }) {
  const color = status === "In Stock" ? "success" : ["Expired", "Out of Stock"].includes(status) ? "error" : "warning";
  return <Chip size="small" variant="outlined" color={color} label={status} />;
}
export function SectionCard({ title, action, children, sx }) {
  return <Card className="surface-card" sx={sx}><CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}><Typography variant="h6" fontWeight={730}>{title}</Typography>{action}</Stack>{children}
  </CardContent></Card>;
}


export function DetailLine({ label, value }) {
  return <Stack direction="row" gap={2} sx={{ justifyContent: "space-between", py: 1 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={650} sx={{ textAlign: "right" }}>{value || "—"}</Typography></Stack>;
}

export function TotalLine({ label, value, strong }) {
  return <Stack direction="row" sx={{ justifyContent: "space-between" }}><Typography variant="body2" fontWeight={strong ? 750 : 450}>{label}</Typography><Typography variant="body2" fontWeight={strong ? 800 : 600}>{formatMoney(value)}</Typography></Stack>;
}

export const emptyCustomer = { name: "", phone: "", email: "", address: "" };

export function validateCustomer(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Full name is required.";
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Enter a valid email address.";
  return errors;
}
