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


export function SaleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, load } = useLoader(() => api.sale(id), [id]);
  const sale = data;
  return <><PageTitle title="Sale details" eyebrow={sale?.invoice_number || "TRANSACTION"}>
    <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/sales")}>Back to Sales</Button>
    {sale && <Button variant="contained" startIcon={<PrintRounded />} onClick={() => navigate(`/invoice/${id}`)}>View Invoice</Button>}
  </PageTitle>
    {loading ? <Skeleton variant="rounded" height={350} /> : error ? <ErrorState error={error} onRetry={load} /> : !sale ? <EmptyState title="Sale not found" /> :
      <Box className="detail-grid">
        <SectionCard title="Sale information"><DetailLine label="Invoice No." value={sale.invoice_number} /><DetailLine label="Date" value={formatDate(sale.date)} /><DetailLine label="Customer" value={sale.customer?.name || "Walk-in Customer"} /><DetailLine label="Payment Method" value={sale.payment_method?.toUpperCase()} />
          <Divider sx={{ my: 2 }} /><TotalLine label="Subtotal" value={sale.subtotal} /><Box sx={{ my: 1 }}><TotalLine label="Discount (−)" value={-Number(sale.discount || 0)} /></Box><TotalLine label="Tax" value={sale.tax} /><Divider sx={{ my: 1.5 }} /><TotalLine label="Total" value={sale.total} strong />
        </SectionCard>
        <SectionCard title={`Items (${sale.items?.length || 0})`}>
          <TableContainer><Table size="small"><TableHead><TableRow>{["Medicine", "Batch", "Qty", "Unit", "Price", "Amount"].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
            <TableBody>{(sale.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.medicine_name || item.name} {item.is_manual_item && <Chip size="small" color="warning" variant="outlined" label="Manual Item" />}</TableCell><TableCell>{item.batch_number || "—"}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.unit || "—"}</TableCell><TableCell>{formatMoney(item.price)}</TableCell><TableCell>{formatMoney(item.line_total ?? item.quantity * item.price)}</TableCell></TableRow>)}</TableBody>
          </Table></TableContainer>
        </SectionCard>
      </Box>}
  </>;
}
