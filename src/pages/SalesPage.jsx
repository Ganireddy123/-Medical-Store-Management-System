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
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { api, daysUntil, formatDate, formatMoney, statusOf } from "../API/context";
import { addItem, clearCart, removeItem, setCartField, setCustomers, setMedicines, setQuantity } from "../store";
import { useAuth } from "../context/AuthContext";
import { EmptyState, ErrorState, LoadingRows, PageTitle, StatCard } from "../components/common";

import { useLoader, rowsOf, SearchBox, DataTable, StatusChip, SectionCard, DetailLine, TotalLine, emptyCustomer, validateCustomer } from "./PageShared";


export function SalesPage() {
  const navigate = useNavigate();
  const { data, loading, error, load } = useLoader(() => api.sales());
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const filtered = rowsOf(data).filter((sale) => `${sale.invoice_number} ${sale.customer?.name || "walk-in"} ${sale.payment_method}`.toLowerCase().includes(search.toLowerCase()));
  async function downloadHistory() {
    setExporting(true);
    setExportError("");
    try {
      const pageSize = 200;
      const sales = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = rowsOf(await api.sales({ limit: pageSize, offset }));
        sales.push(...page);
        if (page.length < pageSize) break;
      }
      if (!sales.length) {
        setExportError("There are no sales to download.");
        return;
      }
      const pdf = new jsPDF({ orientation: "landscape" });
      const pdfMoney = (amount) => formatMoney(amount).replace("₹", "INR ");
      const settings = JSON.parse(localStorage.getItem("medistore_settings") || "{}");
      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
      pdf.setFontSize(18);
      pdf.text(settings.name || "MediStore Pharmacy", 14, 16);
      pdf.setFontSize(14);
      pdf.text("Complete Sales History", 14, 25);
      pdf.setFontSize(9);
      pdf.text(`Generated: ${new Date().toLocaleString()}  |  Transactions: ${sales.length}  |  Total sales: ${pdfMoney(totalSales)}`, 14, 32);
      autoTable(pdf, {
        startY: 38,
        head: [["Invoice", "Date", "Customer", "Payment", "Items", "Subtotal", "Discount", "Tax", "Total"]],
        body: sales.map((sale) => [
          sale.invoice_number || "",
          formatDate(sale.date),
          sale.customer?.name || "Walk-in",
          sale.payment_method?.toUpperCase() || "CASH",
          (sale.items || []).map((item) => `${item.medicine_name || item.name || "Medicine"} × ${item.quantity}`).join("\n"),
          pdfMoney(sale.subtotal),
          pdfMoney(sale.discount),
          pdfMoney(sale.tax),
          pdfMoney(sale.total),
        ]),
        styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [36, 90, 75] },
        columnStyles: {
          0: { cellWidth: 27 },
          1: { cellWidth: 23 },
          2: { cellWidth: 31 },
          3: { cellWidth: 20 },
          4: { cellWidth: "auto" },
          5: { cellWidth: 25, halign: "right" },
          6: { cellWidth: 22, halign: "right" },
          7: { cellWidth: 20, halign: "right" },
          8: { cellWidth: 25, halign: "right" },
        },
        didDrawPage: () => {
          pdf.setFontSize(8);
          pdf.text(`Page ${pdf.internal.getNumberOfPages()}`, pdf.internal.pageSize.getWidth() - 14, pdf.internal.pageSize.getHeight() - 7, { align: "right" });
        },
      });
      pdf.save(`sales-history-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      setExportError(e.message || "Unable to download sales history.");
    } finally {
      setExporting(false);
    }
  }
  return <><PageTitle title="Sales history" eyebrow="TRANSACTIONS">
    <Button variant="outlined" startIcon={exporting ? <CircularProgress size={18} /> : <PictureAsPdfRounded />} onClick={downloadHistory} disabled={loading || exporting}>
      {exporting ? "Preparing PDF..." : "Download History"}
    </Button>
    <Button component={Link} to="/new-sale" variant="contained" startIcon={<AddRounded />}>New Sale</Button>
  </PageTitle>
    {exportError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setExportError("")}>{exportError}</Alert>}
    <Paper variant="outlined" className="filter-bar"><SearchBox value={search} onChange={setSearch} placeholder="Search by invoice, customer or payment..." /><Typography variant="body2" color="text.secondary">{filtered.length} transactions</Typography></Paper>
    <DataTable rows={filtered} loading={loading} error={error} retry={load} emptyTitle="No sales found" columns={[
      { key: "invoice_number", label: "Invoice", render: (row) => <Typography fontWeight={750}>{row.invoice_number}</Typography> },
      { key: "date", label: "Date", render: (row) => formatDate(row.date) },
      { key: "customer", label: "Customer", render: (row) => row.customer?.name || "Walk-in" },
      { key: "payment_method", label: "Payment", render: (row) => <Chip size="small" variant="outlined" label={row.payment_method?.toUpperCase()} /> },
      { key: "items", label: "Items", render: (row) => row.items?.length || 0 },
      { key: "total", label: "Total", align: "right", render: (row) => <Typography fontWeight={750}>{formatMoney(row.total)}</Typography> },
    ]} onRowClick={(row) => navigate(`/sales/${row.id}`)} />;
  </>;
}
