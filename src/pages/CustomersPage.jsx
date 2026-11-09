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


export function CustomersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { data, loading, error, load } = useLoader(() => api.customers());
  const [search, setSearch] = useState("");
  const customers = useMemo(() => rowsOf(data), [data]);
  useEffect(() => { if (data) dispatch(setCustomers(customers)); }, [data, dispatch, customers]);
  const filtered = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageTitle title="Customers" eyebrow="CUSTOMER BOOK"><Button component={Link} to="/customers/new" variant="contained" startIcon={<AddRounded />}>Add Customer</Button></PageTitle>
    <Paper variant="outlined" className="filter-bar"><SearchBox value={search} onChange={setSearch} placeholder="Search by name, phone or email..." /><Typography variant="body2" color="text.secondary">{filtered.length} customers</Typography></Paper>
    <DataTable rows={filtered} loading={loading} error={error} retry={load} emptyTitle={search ? "No matching customers" : "No customers yet"} columns={[
      { key: "name", label: "Name", render: (row) => <Typography fontWeight={700}>{row.name}</Typography> },
      { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
      { key: "address", label: "Address", render: (row) => <Typography noWrap sx={{ maxWidth: 240 }}>{row.address || "—"}</Typography> },
      { key: "created_at", label: "Added", render: (row) => formatDate(row.created_at) },
    ]} onRowClick={(row) => navigate(`/customers/${row.id}`)} />;
  </>;
}
