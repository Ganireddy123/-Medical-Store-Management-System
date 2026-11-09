import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { store } from "./store";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import App from "./App.jsx";

const router = window.location.protocol === "file:" ? HashRouter : BrowserRouter;

const theme = createTheme({
  palette: {
    mode: "light", primary: { main: "#1976d2", light: "#e9f3ff" },
    success: { main: "#17865d" }, warning: { main: "#d88a12" }, error: { main: "#d84d4d" },
    background: { default: "#f4f6f9", paper: "#ffffff" }, text: { primary: "#1d2939", secondary: "#667085" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
    h4: { fontSize: "1.8rem" }, h6: { fontSize: "1rem" },
    button: { textTransform: "none", fontWeight: 650 },
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 9, boxShadow: "none", minHeight: 39 } } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: "#e7ebf0" } } },
    MuiTableCell: { styleOverrides: { head: { color: "#768397", fontWeight: 700, fontSize: ".73rem", textTransform: "uppercase", letterSpacing: ".045em", backgroundColor: "#fafbfd" }, body: { borderColor: "#edf0f4" } } },
    MuiTextField: { defaultProps: { size: "small" } },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      {createElement(router, null,
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider><App /></AuthProvider>
        </ThemeProvider>
      )}
    </Provider>
  </StrictMode>,
)
