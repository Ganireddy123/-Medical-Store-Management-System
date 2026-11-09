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
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import LocalPharmacyRounded from "@mui/icons-material/LocalPharmacyRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { api, daysUntil, formatDate, formatMoney, statusOf } from "../API/context";
import { createInvoicePdf } from "../utils/invoicePdf";
import { addItem, clearCart, removeItem, setCartField, setCustomers, setMedicines, setQuantity } from "../store";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, LoadingRows, PageTitle, StatCard } from "../components/common";

import { useLoader, rowsOf, SearchBox, DataTable, StatusChip, SectionCard, DetailLine, TotalLine, emptyCustomer, validateCustomer } from "./PageShared";


export function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sale, loading, error, load } = useLoader(() => api.sale(id), [id]);
  const settings = JSON.parse(localStorage.getItem("medistore_settings") || "{}");
  function downloadPdf() {
    if (!sale) return;
    createInvoicePdf(sale, settings).save(`${sale.invoice_number}.pdf`);
  }
  return <><PageTitle title="Invoice" eyebrow={sale?.invoice_number || "DOCUMENT"}><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)}>Back</Button><Button variant="outlined" startIcon={<PictureAsPdfRounded />} onClick={downloadPdf} disabled={!sale}>Download PDF</Button><Button variant="contained" startIcon={<PrintRounded />} onClick={() => window.print()} disabled={!sale || loading}>Print Invoice</Button></PageTitle>
    {loading ? <Skeleton variant="rounded" height={500} /> : error ? <ErrorState error={error} onRetry={load} /> : !sale ? <EmptyState title="Invoice not found" /> :
      <Card className="invoice-card"><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2} sx={{ justifyContent: "space-between" }}>
          <Box><Stack direction="row" gap={1} sx={{ alignItems: "center" }}><Box className="brand-icon"><LocalPharmacyRounded /></Box><Typography variant="h5" fontWeight={800}>{settings.name || "MediStore Pharmacy"}</Typography></Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{settings.address || "Your pharmacy address"}</Typography>
            <Typography variant="body2" color="text.secondary">{[settings.phone, settings.email].filter(Boolean).join(" · ") || "Phone · Email"}</Typography></Box>
          <Box sx={{ textAlign: { xs: "left", sm: "right" } }}><Typography variant="h4" color="primary.main" fontWeight={800}>INVOICE</Typography><Typography fontWeight={700}>{sale.invoice_number}</Typography><Typography variant="body2" color="text.secondary">{formatDate(sale.date)}</Typography></Box>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Typography variant="overline" color="text.secondary">BILLED TO</Typography>
        <Typography fontWeight={700}>{sale.customer?.name || "Walk-in Customer"}</Typography><Typography variant="body2" color="text.secondary">{sale.customer?.phone || ""}</Typography>
        <TableContainer sx={{ mt: 3 }}><Table><TableHead><TableRow>{["Medicine", "Batch", "Qty", "Unit", "Price", "Amount"].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{(sale.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.medicine_name || item.name} {item.is_manual_item && <Chip size="small" color="warning" variant="outlined" label="Manual Item" />}</TableCell><TableCell>{item.batch_number || "—"}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.unit || "—"}</TableCell><TableCell>{formatMoney(item.price)}</TableCell><TableCell>{formatMoney(item.line_total ?? item.quantity * item.price)}</TableCell></TableRow>)}</TableBody>
        </Table></TableContainer>
        <Stack spacing={1} sx={{ width: { xs: "100%", sm: 300 }, ml: "auto", mt: 2 }}><TotalLine label="Subtotal" value={sale.subtotal} /><TotalLine label="Discount (−)" value={-Number(sale.discount || 0)} /><TotalLine label="Tax" value={sale.tax} /><Divider /><TotalLine label="Total" value={sale.total} strong /><DetailLine label="Payment method" value={sale.payment_method?.toUpperCase()} /></Stack>
        <Divider sx={{ my: 3 }} /><Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: "center" }}>Thank you for your purchase. Medicines sold are non-returnable unless defective.</Typography>
      </CardContent></Card>}
  </>;
}
