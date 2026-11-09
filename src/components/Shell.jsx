import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Avatar, Badge, Box, Button, Divider, Drawer, IconButton, InputAdornment,
  List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, TextField,
  Toolbar, Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardRounded from "@mui/icons-material/DashboardRounded";
import PointOfSaleRounded from "@mui/icons-material/PointOfSaleRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import MedicationRounded from "@mui/icons-material/MedicationRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import EventBusyRounded from "@mui/icons-material/EventBusyRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import LocalPharmacyRounded from "@mui/icons-material/LocalPharmacyRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { useAuth } from "../context/AuthContext";
import { api } from "../API/context";

const navGroups = [
  { label: "WORKSPACE", links: [{ label: "Dashboard", path: "/dashboard", icon: <DashboardRounded /> }] },
  { label: "SALES", links: [{ label: "New Sale", path: "/new-sale", icon: <PointOfSaleRounded /> }, { label: "Sales History", path: "/sales", icon: <ReceiptLongRounded /> }] },
  { label: "INVENTORY", links: [{ label: "Medicines", path: "/medicines", icon: <MedicationRounded /> }, { label: "Stock", path: "/inventory", icon: <Inventory2Rounded /> }, { label: "Expiry Alerts", path: "/expiry-alerts", icon: <EventBusyRounded /> }] },
  { label: "CUSTOMERS", links: [{ label: "Customers", path: "/customers", icon: <PeopleAltRounded /> }] },
  { label: "INSIGHTS", links: [{ label: "Reports", path: "/reports", icon: <BarChartRounded /> }] },
  { label: "SYSTEM", links: [{ label: "Settings", path: "/settings", icon: <SettingsRounded /> }] },
];
const titles = {
  "/dashboard": "Dashboard", "/new-sale": "New Sale", "/sales": "Sales History", "/medicines": "Medicines",
  "/inventory": "Stock overview", "/expiry-alerts": "Expiry alerts", "/customers": "Customers",
  "/reports": "Reports & insights", "/settings": "Store settings",
};

export default function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    api.expiring(30).then((data) => setAlertCount(data.length)).catch(() => setAlertCount(0));
  }, [location.pathname]);
  const pageTitle = titles[location.pathname] || (location.pathname.includes("/edit") ? "Edit Medicine" :
    location.pathname.includes("/medicines/new") ? "Add Medicine" : location.pathname.includes("/customers/new") ? "Add Customer" :
      location.pathname.includes("/customers/") ? "Customer details" : location.pathname.includes("/invoice/") ? "Invoice" :
        location.pathname.includes("/sales/") ? "Sale details" : "MediStore");

  const sidebar = <Box className="sidebar-content">
    <Box className="brand">
      <Box className="brand-icon"><LocalPharmacyRounded /></Box>
      <Box><Typography fontWeight={800} sx={{ lineHeight: 1.15 }}>MediStore</Typography><Typography variant="caption" color="text.secondary">Medical Store</Typography></Box>
    </Box>
    <Box className="nav-scroll">{navGroups.map((group) => <Box key={group.label} sx={{ mb: 2.2 }}>
      <Typography className="nav-group-title">{group.label}</Typography>
      <List disablePadding>{group.links.map((item) => {
        const active = location.pathname === item.path ||
          (item.path === "/medicines" && location.pathname.startsWith("/medicines")) ||
          (item.path === "/sales" && location.pathname.startsWith("/sales")) ||
          (item.path === "/customers" && location.pathname.startsWith("/customers"));
        return <ListItemButton key={item.path} component={Link} to={item.path} selected={active} onClick={() => setDrawerOpen(false)} className="nav-item">
          <ListItemIcon>{item.icon}</ListItemIcon><ListItemText primary={item.label} />
        </ListItemButton>;
      })}</List>
    </Box>)}</Box>
    <Box className="sidebar-footer"><Divider sx={{ mb: 1.5 }} />
      <ListItemButton className="logout-link" onClick={() => { logout(); navigate("/login"); }}>
        <ListItemIcon><LogoutRounded /></ListItemIcon><ListItemText primary="Sign out" />
      </ListItemButton>
      <Paper variant="outlined" className="profile-mini"><Avatar sx={{ width: 34, height: 34, bgcolor: "primary.light" }}>{(user?.name || "A")[0]}</Avatar>
        <Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={650} noWrap>{user?.name || "Store Admin"}</Typography><Typography variant="caption" color="text.secondary">Administrator</Typography></Box>
      </Paper>
    </Box>
  </Box>;
  return <Box className="app-shell">
    {mobile ? <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} slotProps={{ paper: { sx: { width: 260 } } }}>{sidebar}</Drawer> :
      <Box component="aside" className="sidebar">{sidebar}</Box>}
    <Box className="main-panel">
      <AppBar position="sticky" elevation={0} color="inherit" className="topbar">
        <Toolbar className="topbar-toolbar">
          {mobile && <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}><MenuRounded /></IconButton>}
          <Typography variant="h6" fontWeight={750} sx={{ flexGrow: 1 }}>{pageTitle}</Typography>
          <TextField size="small" placeholder="Search anything..." className="global-search" slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          <Tooltip title={`${alertCount} expiry alerts`}><IconButton className="notification-button" onClick={() => navigate("/expiry-alerts")}><Badge color="error" variant="dot" invisible={!alertCount}><NotificationsNoneRounded /></Badge></IconButton></Tooltip>
          <Button onClick={(event) => setMenuAnchor(event.currentTarget)} className="account-button" endIcon={<KeyboardArrowDownRounded />}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}>{(user?.name || "A")[0]}</Avatar>
            <Box className="account-name"><Typography variant="body2" fontWeight={700}>{user?.name || "Store Admin"}</Typography><Typography variant="caption" color="text.secondary">Administrator</Typography></Box>
          </Button>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1, minWidth: 210 }}><Typography fontWeight={700}>{user?.name || "Store Admin"}</Typography><Typography variant="caption" color="text.secondary">{user?.email}</Typography></Box>
            <Divider /><MenuItem onClick={() => { setMenuAnchor(null); navigate("/settings"); }}><PersonOutlineRounded sx={{ mr: 1 }} />Profile & settings</MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); logout(); navigate("/login"); }}><LogoutRounded sx={{ mr: 1 }} />Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="main" className="page-content"><Outlet /></Box>
      <Box component="footer" className="app-footer"><Typography variant="caption">MediStore · Pharmacy operations made simple</Typography><Typography variant="caption">Offline · Stored on this device</Typography></Box>
    </Box>
  </Box>;
}
