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


export function ExpiryAlertsPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error, load } = useLoader(() => api.expiring(days), [days]);
  const rows = rowsOf(data).map((batch) => ({ ...batch, daysLeft: daysUntil(batch.expiry_date) }));
  const expired = rows.filter((row) => row.daysLeft < 0).length;
  return <><PageTitle title="Expiry alerts" eyebrow="INVENTORY HEALTH"><Stack direction="row" gap={1}>{[30, 60, 90].map((value) => <Button key={value} variant={days === value ? "contained" : "outlined"} onClick={() => setDays(value)}>{value} days</Button>)}</Stack></PageTitle>
    {!loading && !error && rows.length > 0 && <Alert severity={expired ? "error" : "warning"} sx={{ mb: 2 }}>{expired ? `${expired} batch${expired === 1 ? " is" : "es are"} already expired — do not sell.` : `${rows.length} batches expiring within ${days} days.`}</Alert>}
    <DataTable rows={rows} loading={loading} error={error} retry={load} pagination={false} emptyTitle="Nothing expiring" emptySubtitle={`No batches are expired or expiring within ${days} days.`} columns={[
      { key: "medicine", label: "Medicine", render: (row) => <Typography fontWeight={650}>{row.medicine?.name || "—"}</Typography> },
      { key: "batch_number", label: "Batch" }, { key: "expiry_date", label: "Expiry Date", render: (row) => formatDate(row.expiry_date) },
      { key: "daysLeft", label: "Days Left", render: (row) => <Chip size="small" color={row.daysLeft < 0 ? "error" : row.daysLeft <= 15 ? "warning" : "default"} label={row.daysLeft < 0 ? `Expired ${Math.abs(row.daysLeft)}d ago` : `${row.daysLeft} days`} /> },
      { key: "quantity", label: "Quantity", align: "right", render: (row) => <Typography fontWeight={700}>{row.quantity}</Typography> },
    ]} />;
  </>;
}
