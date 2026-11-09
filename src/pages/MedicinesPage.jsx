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


export function MedicinesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data, loading, error, load, setData } = useLoader(() => api.medicines());
  const [search, setSearch] = useState("");
  const [medicineToDelete, setMedicineToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const medicines = useMemo(() => rowsOf(data), [data]);
  useEffect(() => { if (data) dispatch(setMedicines(medicines)); }, [data, dispatch, medicines]);
  const filtered = medicines.filter((item) => `${item.name} ${item.generic_name} ${item.manufacturer} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  async function deleteMedicine() {
    if (!medicineToDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteMedicine(medicineToDelete.id);
      setData((current) => rowsOf(current).filter((medicine) => medicine.id !== medicineToDelete.id));
      setMedicineToDelete(null);
    } catch (e) {
      setDeleteError(e.message || "Unable to delete medicine.");
    } finally {
      setDeleting(false);
    }
  }
  return <><PageTitle title="Medicines" eyebrow="PRODUCT CATALOG"><Button component={Link} to="/medicines/new" variant="contained" startIcon={<AddRounded />}>Add Medicine</Button></PageTitle>
    <Paper variant="outlined" className="filter-bar"><SearchBox value={search} onChange={setSearch} placeholder="Search medicines..." /><Typography variant="body2" color="text.secondary">{filtered.length} medicines</Typography></Paper>
    <DataTable rows={filtered} loading={loading} error={error} retry={load} emptyTitle={search ? "No matching medicines" : "No medicines added"} columns={[
      { key: "name", label: "Medicine", sortKey: "name", render: (row) => <Box><Typography fontWeight={700}>{row.name}</Typography><Typography variant="caption" color="text.secondary">{row.generic_name || "Generic name not set"}</Typography></Box> },
      { key: "strength", label: "Strength", sortKey: "strength" }, { key: "manufacturer", label: "Manufacturer", sortKey: "manufacturer" }, { key: "category", label: "Category", sortKey: "category" },
      { key: "selling_price", label: "Price", sortKey: "selling_price", align: "right", render: (row) => <Typography fontWeight={700}>{formatMoney(row.selling_price)}</Typography> },
      { key: "actions", label: "Actions", align: "right", render: (row) => <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <IconButton size="small" aria-label={`Edit ${row.name}`} onClick={(e) => { e.stopPropagation(); navigate(`/medicines/${row.id}/edit`); }}><EditRounded fontSize="small" /></IconButton>
        <IconButton size="small" color="error" aria-label={`Delete ${row.name}`} onClick={(e) => { e.stopPropagation(); setDeleteError(""); setMedicineToDelete(row); }}><DeleteOutlineRounded fontSize="small" /></IconButton>
      </Stack> },
    ]} onRowClick={(row) => navigate(`/medicines/${row.id}/edit`)} />
    <Dialog open={Boolean(medicineToDelete)} onClose={() => { if (!deleting) setMedicineToDelete(null); }}>
      <DialogTitle>Delete medicine?</DialogTitle>
      <DialogContent>
        {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
        <Typography>Delete {medicineToDelete?.name}? Medicines with batches or existing stock cannot be deleted.</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={deleting} onClick={() => setMedicineToDelete(null)}>Cancel</Button>
        <Button color="error" variant="contained" disabled={deleting} onClick={deleteMedicine}>
          {deleting ? <CircularProgress size={19} /> : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}

const blankMedicine = { name: "", generic_name: "", strength: "", manufacturer: "", category: "", reorder_level: 10, selling_price: "", buying_price: "", description: "" };
