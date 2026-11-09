import { lazy, Suspense } from "react";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import Shell from "./components/Shell";
import { useAuth } from "./context/AuthContext";
import { api } from "./API/context";

const LoginScreen = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginScreen })));
const Dashboard = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.Dashboard })));
const MedicinesPage = lazy(() => import("./pages/MedicinesPage").then((module) => ({ default: module.MedicinesPage })));
const MedicineForm = lazy(() => import("./pages/MedicineForm").then((module) => ({ default: module.MedicineForm })));
const InventoryPage = lazy(() => import("./pages/InventoryPage").then((module) => ({ default: module.InventoryPage })));
const ExpiryAlertsPage = lazy(() => import("./pages/ExpiryAlertsPage").then((module) => ({ default: module.ExpiryAlertsPage })));
const NewSalePage = lazy(() => import("./pages/NewSalePage").then((module) => ({ default: module.NewSalePage })));
const SalesPage = lazy(() => import("./pages/SalesPage").then((module) => ({ default: module.SalesPage })));
const SaleDetailsPage = lazy(() => import("./pages/SaleDetailsPage").then((module) => ({ default: module.SaleDetailsPage })));
const InvoicePage = lazy(() => import("./pages/InvoicePage").then((module) => ({ default: module.InvoicePage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const CustomersPage = lazy(() => import("./pages/CustomersPage").then((module) => ({ default: module.CustomersPage })));
const CustomerForm = lazy(() => import("./pages/CustomerForm").then((module) => ({ default: module.CustomerForm })));
const CustomerDetailsPage = lazy(() => import("./pages/CustomerDetailsPage").then((module) => ({ default: module.CustomerDetailsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function RequireAuth({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return <Box className="auth-loading"><CircularProgress /></Box>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
export default function App() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    api.settings().then((settings) => localStorage.setItem("medistore_settings", JSON.stringify(settings)))
      .catch((error) => console.error("Unable to load offline store settings:", error));
  }, []);
  return <Routes>
    <Route path="/login" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}>{isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginScreen />}</Suspense>} />
    <Route element={<RequireAuth><Shell /></RequireAuth>}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><Dashboard /></Suspense>} />
      <Route path="/medicines" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><MedicinesPage /></Suspense>} />
      <Route path="/medicines/new" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><MedicineForm /></Suspense>} />
      <Route path="/medicines/:id/edit" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><MedicineForm /></Suspense>} />
      <Route path="/inventory" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><InventoryPage /></Suspense>} />
      <Route path="/expiry-alerts" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><ExpiryAlertsPage /></Suspense>} />
      <Route path="/new-sale" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><NewSalePage /></Suspense>} />
      <Route path="/sales" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><SalesPage /></Suspense>} />
      <Route path="/sales/:id" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><SaleDetailsPage /></Suspense>} />
      <Route path="/invoice/:id" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><InvoicePage /></Suspense>} />
      <Route path="/reports" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><ReportsPage /></Suspense>} />
      <Route path="/customers" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><CustomersPage /></Suspense>} />
      <Route path="/customers/new" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><CustomerForm /></Suspense>} />
      <Route path="/customers/:id" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><CustomerDetailsPage /></Suspense>} />
      <Route path="/settings" element={<Suspense fallback={<Box className="auth-loading"><CircularProgress /></Box>}><SettingsPage /></Suspense>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
