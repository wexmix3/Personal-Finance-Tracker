"use client";

import { useState } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiFetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface AccountPerf {
  id: string;
  name: string;
  institution_name: string | null;
  subtype: string | null;
  current_balance: number;
  first_balance: number;
  change: number;
  change_pct: number;
  history: { date: string; value: number }[];
}

interface InvestmentsData {
  portfolio_value: number;
  portfolio_cost: number;
  total_change: number;
  total_change_pct: number;
  accounts: AccountPerf[];
}

const PERIODS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

function ChangeChip({ change, pct }: { change: number; pct: number }) {
  const up = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}{formatCurrency(change)} ({up ? "+" : ""}{pct.toFixed(2)}%)
    </span>
  );
}

function MiniChart({ history }: { history: { date: string; value: number }[] }) {
  if (history.length < 2) return <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">Not enough data</div>;
  const first = history[0].value;
  const last = history[history.length - 1].value;
  const up = last >= first;
  const color = up ? "#10b981" : "#f43f5e";

  const data = history.map(h => ({
    date: new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: h.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${up}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#grad-${up})`} dot={false} />
        <Tooltip
          formatter={(v: number) => formatCurrency(v)}
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
          itemStyle={{ color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function InvestmentsPage() {
  const [days, setDays] = useState(90);
  const { data, isLoading } = useSWR<InvestmentsData>(
    `/api/investments?days=${days}`,
    apiFetcher,
    { keepPreviousData: true }
  );

  const portfolioUp = (data?.total_change ?? 0) >= 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Portfolio performance since first recorded balance</p>
        </div>
        <div className="flex rounded-xl border bg-white overflow-hidden">
          {PERIODS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${days === d ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-28 rounded-2xl bg-white border animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-36 rounded-2xl bg-white border animate-pulse" />)}
          </div>
        </div>
      ) : !data || data.accounts.length === 0 ? (
        <div className="rounded-2xl bg-white border flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
          <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
            <TrendingUp size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-base">No investment accounts</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Add accounts with type "Investment" to track your portfolio performance here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Portfolio summary */}
          <div className="rounded-2xl bg-white border p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Portfolio Value</p>
              <p className="text-3xl font-bold">{formatCurrency(data.portfolio_value)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cost Basis (first snapshot)</p>
              <p className="text-2xl font-semibold text-muted-foreground">{formatCurrency(data.portfolio_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Gain / Loss</p>
              <p className={`text-2xl font-bold ${portfolioUp ? "text-emerald-600" : "text-rose-500"}`}>
                {portfolioUp ? "+" : ""}{formatCurrency(data.total_change)}
              </p>
              <ChangeChip change={data.total_change} pct={data.total_change_pct} />
            </div>
          </div>

          {/* Account cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.accounts.map(acct => (
              <div key={acct.id} className="rounded-2xl bg-white border p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{acct.name}</p>
                    {acct.institution_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{acct.institution_name}</p>
                    )}
                  </div>
                  {acct.subtype && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-primary font-medium capitalize">
                      {acct.subtype}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold">{formatCurrency(acct.current_balance)}</span>
                  {acct.first_balance !== acct.current_balance && (
                    <ChangeChip change={acct.change} pct={acct.change_pct} />
                  )}
                </div>

                {acct.first_balance !== acct.current_balance && (
                  <p className="text-xs text-muted-foreground">
                    from {formatCurrency(acct.first_balance)} (first recorded)
                  </p>
                )}

                <MiniChart history={acct.history} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}