"use client";

import { useState } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetcher, netWorthKey, netWorthHistoryKey } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { EmptyState } from "@/components/ui/EmptyState";
import type { NetWorthResponse } from "@/types/api";

interface HistoryPoint { date: string; net_worth: number; assets: number; liabilities: number; }

const STATIC_PERIODS = [{ label: "30d", days: 30 }, { label: "90d", days: 90 }, { label: "1y", days: 365 }];

function ytdDays() {
  return Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000);
}

const SERIES = [
  { key: "assets", label: "Assets", color: "#10b981", gradId: "assetsGrad" },
  { key: "net_worth", label: "Net Worth", color: "#6366f1", gradId: "nwGrad" },
];

export default function NetWorthPage() {
  const [days, setDays] = useState(90);
  const [isYtd, setIsYtd] = useState(false);
  const activeDays = isYtd ? ytdDays() : days;

  const { data: nw } = useSWR<NetWorthResponse>(netWorthKey(), apiFetcher);
  const { data: history } = useSWR<HistoryPoint[]>(netWorthHistoryKey(activeDays), apiFetcher, { keepPreviousData: true });

  const chartData = (history ?? []).map((p) => ({
    ...p,
    date: new Date(p.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const first = history?.[0]?.net_worth ?? 0;
  const last = history?.[history.length - 1]?.net_worth ?? 0;
  const change = last - first;
  const pct = first !== 0 ? ((change / Math.abs(first)) * 100).toFixed(1) : null;
  const nwPositive = (nw?.net_worth ?? 0) >= 0;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Net Worth</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Assets minus liabilities over time</p>
        </div>
        <div className="flex rounded-xl border bg-white overflow-hidden shadow-sm">
          {STATIC_PERIODS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => { setDays(d); setIsYtd(false); }}
              className={`px-4 py-2 text-xs font-medium transition-colors ${!isYtd && days === d ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setIsYtd(true)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${isYtd ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            YTD
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`rounded-2xl bg-white border card-base p-5 ${nwPositive ? "stat-accent-emerald" : "stat-accent-rose"}`}>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Current Net Worth</p>
          <p className="font-display text-2xl font-bold"><AnimatedNumber value={nw?.net_worth ?? 0} prefix="$" decimals={0} /></p>
          {pct && (
            <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${change >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change >= 0 ? "+" : ""}{formatCurrency(change)} ({pct}%) this period
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-white border card-base stat-accent-emerald p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Total Assets</p>
          <p className="font-display text-2xl font-bold text-emerald-600"><AnimatedNumber value={nw?.total_assets ?? 0} prefix="$" decimals={0} /></p>
        </div>
        <div className="rounded-2xl bg-white border card-base stat-accent-rose p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Total Liabilities</p>
          <p className="font-display text-2xl font-bold text-rose-500"><AnimatedNumber value={nw?.total_liabilities ?? 0} prefix="$" decimals={0} /></p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 ? (
        <div className="rounded-2xl bg-white border card-base p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold">History</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isYtd ? "Year to date" : `Last ${days} days`}
              </p>
            </div>
            {/* HTML legend — replaces Recharts <Legend> */}
            <div className="flex items-center gap-4">
              {SERIES.map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3251" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(v: number, name: string) => [formatCurrency(v), name === "assets" ? "Assets" : "Net Worth"]}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #1e3251", background: "#0d1b2e", color: "#e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}
                cursor={{ stroke: "#64748b", strokeWidth: 1, strokeDasharray: "4 2" }}
              />
              <Area
                type="monotone"
                dataKey="assets"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#assetsGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="net_worth"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#nwGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          icon={<BarChart2 size={28} />}
          title="Not enough data yet"
          description="Update your account balances regularly to build up a history and see trends over time."
        />
      )}
    </div>
  );
}
