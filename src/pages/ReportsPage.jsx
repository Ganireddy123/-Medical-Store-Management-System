import { useState } from "react";
import {
  Box, Button, LinearProgress, Paper, Skeleton, Stack, TextField, Typography,
} from "@mui/material";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, formatMoney } from "../API/context";
import { EmptyState, ErrorState, PageTitle, StatCard, LoadingRows } from "../components/common";
import { SectionCard, rowsOf, useLoader } from "./PageShared";

export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const prior = new Date();
  prior.setDate(prior.getDate() - 30);
  const [from, setFrom] = useState(prior.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [range, setRange] = useState({ from, to });
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error, load } = useLoader(async () => {
    const [daily, monthly, top, payment] = await Promise.all([
      api.report("daily", range),
      api.report("monthly"),
      api.report("top-medicines", range),
      api.report("payment-summary", range),
    ]);
    return {
      daily: rowsOf(daily).filter((row) => !row.date || (row.date >= range.from && row.date <= range.to)),
      monthly: rowsOf(monthly),
      top: rowsOf(top),
      payment: rowsOf(payment),
    };
  }, [range.from, range.to, refreshKey]);
  const revenue = (data?.daily || []).reduce((sum, row) => sum + Number(row.revenue || row.total || 0), 0);
  const bestSeller = data?.top?.[0]?.name || "—";

  return <>
    <PageTitle title="Reports & insights" eyebrow="PERFORMANCE">
      <Typography color="text.secondary" variant="body2">Understand your store's performance at a glance.</Typography>
    </PageTitle>
    <SectionCard title="Date range" sx={{ mb: 2.2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
        <TextField label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="contained" disabled={from > to} onClick={() => {
          setRange({ from, to });
          setRefreshKey((key) => key + 1);
        }}>Apply Range</Button>
      </Stack>
    </SectionCard>
    {error && <Box sx={{ mb: 2 }}><ErrorState error={error} onRetry={load} /></Box>}
    <Box className="stats-grid reports-stats">
      <StatCard title="Revenue (selected range)" value={revenue} currency loading={loading} />
      <StatCard title="Orders (selected range)" value={data?.daily?.length || 0} loading={loading} />
      <StatCard title="Best Seller" value={bestSeller} loading={loading} />
    </Box>
    <Box className="reports-chart-grid">
      <SectionCard title="Daily Revenue" sx={{ gridColumn: "1 / -1" }}>
        {loading ? <Skeleton height={250} /> : data?.daily?.length ?
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.daily} margin={{ left: -15, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
              <YAxis /><Tooltip formatter={(value) => formatMoney(value)} /><Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#2484d8" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer> : <EmptyState title="No data for this range" />}
      </SectionCard>
      <SectionCard title="Monthly Revenue">
        {loading ? <Skeleton height={240} /> : <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data?.monthly || []}><CartesianGrid strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => formatMoney(value)} />
            <Bar dataKey="revenue" fill="#25a575" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>}
      </SectionCard>
      <SectionCard title="Top Medicines">
        {loading ? <LoadingRows rows={5} /> : data?.top?.length ? <Stack spacing={2}>
          {data.top.slice(0, 8).map((item) => {
            const max = Math.max(...data.top.map((entry) => Number(entry.quantity) || 0), 1);
            return <Box key={item.name}>
              <Stack direction="row" gap={1} sx={{ justifyContent: "space-between" }}>
                <Typography fontWeight={650} variant="body2">{item.name}</Typography>
                <Typography variant="caption" color="text.secondary">{item.quantity} sold · {formatMoney(item.revenue)}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={Math.min(100, item.quantity / max * 100)} sx={{ mt: .7, height: 6, borderRadius: 4 }} />
            </Box>;
          })}
        </Stack> : <EmptyState title="No top products" />}
      </SectionCard>
      <SectionCard title="Payment Methods" sx={{ gridColumn: "1 / -1" }}>
        <Box className="payment-grid">{(data?.payment || []).map((item) => <Paper variant="outlined" key={item.method} className="payment-tile">
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>{item.method}</Typography>
          <Typography variant="h6" fontWeight={750}>{formatMoney(item.total)}</Typography>
          <Typography variant="caption" color="text.secondary">{item.orders} orders</Typography>
        </Paper>)}</Box>
      </SectionCard>
    </Box>
  </>;
}
