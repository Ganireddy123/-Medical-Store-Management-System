import {
  Alert, Box, Button, Card, CardContent, Skeleton, Stack, Typography,
} from "@mui/material";
import { useState } from "react";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { formatMoney } from "../API/context";

export function ErrorState({ error, onRetry }) {
  return <Alert severity="error" action={onRetry ? <Button color="inherit" size="small" startIcon={<ReplayRounded />} onClick={onRetry}>Retry</Button> : null}>
    {error?.message || error || "Something went wrong. Please try again."}
  </Alert>;
}
export function EmptyState({ title = "Nothing here yet", subtitle = "Your data will appear here when it’s available.", icon }) {
  return <Stack spacing={1} sx={{ alignItems: "center", justifyContent: "center", py: 7, color: "text.secondary" }}>
    {icon || <InboxRounded sx={{ fontSize: 38, color: "primary.light" }} />}
    <Typography fontWeight={650} color="text.primary">{title}</Typography>
    <Typography variant="body2" sx={{ textAlign: "center" }}>{subtitle}</Typography>
  </Stack>;
}
export function StatCard({ title, value, icon, color = "primary", loading = false, currency = false, subtitle, revealOnClick = false }) {
  const [revealed, setRevealed] = useState(false);
  const revealProps = revealOnClick ? {
    role: "button",
    tabIndex: 0,
    "aria-pressed": revealed,
    "aria-label": `${title}: ${revealed ? "visible. Move the pointer away or press Escape to hide." : "hidden. Activate to reveal."}`,
    onClick: () => setRevealed(true),
    onMouseLeave: () => setRevealed(false),
    onKeyDown: (event) => {
      if (event.key === "Escape") setRevealed(false);
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setRevealed(true);
      }
    },
  } : {};
  return <Card className="surface-card" sx={{ height: "100%", ...(revealOnClick ? { cursor: "pointer" } : {}) }} {...revealProps}><CardContent sx={{ p: 2.5 }}>
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>{title}</Typography>
        {loading ? <Skeleton width={100} height={42} /> : <Typography variant="h4" fontWeight={750} sx={{ mt: .6, letterSpacing: "-.04em" }}>{revealOnClick && !revealed ? "••••" : currency ? formatMoney(value) : value}</Typography>}
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </Box>
      <Box className={`stat-icon stat-${color}`}>{icon}</Box>
    </Stack>
  </CardContent></Card>;
}
export function PageTitle({ title, eyebrow, children }) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", mb: 2.5 }}>
    <Box>{eyebrow && <Typography variant="overline" color="primary.main" fontWeight={750}>{eyebrow}</Typography>}
      <Typography variant="h4" fontWeight={760} letterSpacing="-.04em">{title}</Typography></Box>
    {children && <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>{children}</Stack>}
  </Stack>;
}
export function LoadingRows({ rows = 5, columns = 5 }) {
  return <Stack spacing={1.4} sx={{ py: 2 }}>{Array.from({ length: rows }, (_, i) => <Skeleton key={i} variant="rounded" height={48} sx={{ width: `${98 - (i % 3) * 5}%` }} />)}
    <span className="sr-only">{columns} columns loading</span></Stack>;
}
