"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { TrendingDown, TrendingUp, Plus, X } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetcher, apiPost, accountsKey } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AccountResponse } from "@/types/api";

const COLORS = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#818cf8","#4f46e5","#7c3aed","#9333ea","#a855f7","#d946ef"];

interface SpendingItem { category: string; total: number; }
interface SpendingData {
  expenses: SpendingItem[];
  income_total: number;
  prior_total: number;
}

interface IncomeEntry {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  date: string;
  category: string[] | null;
  account_name: string | null;
}

interface IncomeData {
  items: IncomeEntry[];
  total: number;
  count: number;
}

function AddIncomeModal({ accounts, onSuccess }: { accounts: AccountResponse[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim()) { setError("Enter a description"); return; }
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid positive amount"); return; }
    if (!accountId) { setError("Select an account"); return; }

    setSaving(true);
    setError("");
    try {
      await apiPost("/api/transactions", {
        account_id: accountId,
        name: description.trim(),
        amount: -Math.abs(amt),
        date,
        category: ["Income"],
        pending: false,
        currency: "USD",
      });
      setOpen(false);
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save income");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
      >
        <Plus size={13} /> Add Income
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add Income</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Source / Description</label>
          <input
            className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Salary, Freelance, Dividend…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              className="w-full rounded-xl border bg-white pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0.00"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Account</label>
            <select
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              required
            >
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Log Income"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ytdDays() {
  return Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000);
}

const STATIC_PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function SpendingPage() {
  const [days, setDays] = useState(30);
  const [isYtd, setIsYtd] = useState(false);
  const [isAllTime, setIsAllTime] = useState(false);
  const [incomeRefreshKey, setIncomeRefreshKey] = useState(0);
  const refreshIncome = useCallback(() => setIncomeRefreshKey(k => k + 1), []);

  const activeDays = isAllTime ? 0 : isYtd ? ytdDays() : days;

  const { data, isLoading } = useSWR<SpendingData>(
    `/api/spending?days=${activeDays}`,
    apiFetcher,
    { keepPreviousData: true, refreshInterval: 30000, revalidateOnFocus: true }
  );

  const { data: incomeData } = useSWR<IncomeData>(
    [`/api/income?days=${activeDays}`, incomeRefreshKey],
    ([k]) => apiFetcher(k),
    { keepPreviousData: true }
  );

  const { data: accounts } = useSWR<AccountResponse[]>(accountsKey(), apiFetcher);

  const spending = data?.expenses ?? [];
  const incomeTotal = data?.income_total ?? 0;
  const priorTotal = data?.prior_total ?? 0;
  const total = spending.reduce((s, c) => s + c.total, 0);
  const incomeEntries = incomeData?.items ?? [];

  const delta = priorTotal > 0 ? ((total - priorTotal) / priorTotal) * 100 : null;
  const savings = incomeTotal - total;
  const savingsRate = incomeTotal > 0 ? (savings / incomeTotal) * 100 : null;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Spending</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Where your money is going</p>
        </div>
        {/* Period selector */}
        <div className="flex rounded-xl border bg-white overflow-hidden shadow-sm">
          {STATIC_PERIODS.map(({ label, days: d }) => (
            <button
              key={d}
              onClick={() => { setDays(d); setIsYtd(false); setIsAllTime(false); }}
              className={`px-4 py-2 text-xs font-medium transition-colors ${!isYtd && !isAllTime && days === d ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { setIsYtd(true); setIsAllTime(false); }}
            className={`px-4 py-2 text-xs font-medium transition-colors ${isYtd && !isAllTime ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            YTD
          </button>
          <button
            onClick={() => { setIsAllTime(true); setIsYtd(false); }}
            className={`px-4 py-2 text-xs font-medium transition-colors ${isAllTime ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            All
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="rounded-2xl bg-white border card-base h-28 animate-pulse" />)}
        </div>
      ) : !spending || spending.length === 0 ? (
        <div className="rounded-2xl bg-white border card-base flex items-center justify-center py-24">
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            No spending data for this period. Import transactions to see your breakdown.
          </p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Spent */}
            <div className="rounded-2xl bg-white border card-base stat-accent-primary p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Total Spent</p>
              <p className="font-display text-2xl font-bold">{formatCurrency(total)}</p>
              {delta !== null && (
                <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${delta <= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {delta <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {delta > 0 ? "+" : ""}{delta.toFixed(1)}% vs prior period
                </p>
              )}
            </div>

            {/* Income */}
            <div className="rounded-2xl bg-white border card-base stat-accent-emerald p-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Income</p>
              <p className="font-display text-2xl font-bold text-emerald-600">{formatCurrency(incomeTotal)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {isYtd ? "Year to date" : isAllTime ? "All time" : `Last ${days} days`}
              </p>
            </div>

            {/* Net savings */}
            <div className={`rounded-2xl bg-white border card-base p-5 ${savings >= 0 ? "stat-accent-emerald" : "stat-accent-rose"}`}>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Net Savings</p>
              <p className={`font-display text-2xl font-bold ${savings >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {savings >= 0 ? "" : "-"}{formatCurrency(Math.abs(savings))}
              </p>
              {savingsRate !== null && (
                <p className="text-xs text-muted-foreground mt-2">
                  {savingsRate.toFixed(0)}% savings rate
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut — HTML legend outside */}
            <div className="rounded-2xl bg-white border card-base p-6">
              <h2 className="font-display font-semibold mb-1">By Category</h2>
              <p className="text-xs text-muted-foreground mb-5">
                Total: {formatCurrency(total)}
              </p>

              {/* Chart + legend side by side */}
              <div className="flex gap-5 items-center">
                {/* Donut with center label */}
                <div className="relative flex-shrink-0" style={{ width: 180, height: 180 }}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={spending}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {spending.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [formatCurrency(v), name]}
                        contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(220,13%,90%)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground leading-none">Total</p>
                    <p className="text-sm font-bold tabular-nums mt-0.5 leading-tight">{formatCurrency(total)}</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2.5 min-w-0">
                  {spending.map((item, i) => (
                    <div key={item.category} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground flex-1 truncate">{item.category}</span>
                      <span className="text-xs font-semibold tabular-nums">{((item.total / total) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Horizontal bar */}
            <div className="rounded-2xl bg-white border card-base p-6">
              <h2 className="font-display font-semibold mb-5">Top Categories</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spending.slice(0, 7)} layout="vertical" barSize={12} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={86}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Spent"]}
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid hsl(220,13%,90%)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                    cursor={{ fill: "hsl(220,14%,96%)" }}
                  />
                  <Bar dataKey="total" radius={[0, 5, 5, 0]}>
                    {spending.slice(0, 7).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Full category table */}
          <div className="rounded-2xl bg-white border card-base overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">All Categories</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Category</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-right font-medium">% of Total</th>
                  <th className="px-5 py-3 text-right font-medium hidden sm:table-cell">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {spending.map((item, i) => (
                  <tr key={item.category} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="font-medium">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatCurrency(item.total)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{((item.total / total) * 100).toFixed(1)}%</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <div className="flex items-center justify-end">
                        <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(item.total / spending[0].total) * 100}%`, background: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Income section */}
          <div className="rounded-2xl bg-white border card-base overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-emerald-50/60 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-emerald-800">Income</h2>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {formatCurrency(incomeTotal)} {isYtd ? "year to date" : isAllTime ? "all time" : `last ${days} days`}
                </p>
              </div>
              {Array.isArray(accounts) && accounts.length > 0 && (
                <AddIncomeModal accounts={accounts} onSuccess={refreshIncome} />
              )}
            </div>
            {incomeEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                <p className="text-sm text-muted-foreground">No income recorded for this period.</p>
                {Array.isArray(accounts) && accounts.length > 0 && (
                  <p className="text-xs text-muted-foreground">Use "Add Income" to log a paycheck, freelance payment, or deposit.</p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">Date</th>
                    <th className="px-5 py-3 text-left font-medium">Source</th>
                    <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Account</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incomeEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium truncate max-w-[200px]">{entry.merchant_name ?? entry.name}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[120px]">
                        {entry.account_name}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-600">
                        +{formatCurrency(Math.abs(entry.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
