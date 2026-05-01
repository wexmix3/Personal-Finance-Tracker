"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${color.replace("#", "")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { apiFetcher, netWorthKey, netWorthHistoryKey, accountsKey, transactionsKey } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { AddAccountModal } from "@/components/dashboard/AddAccountModal";
import { ImportCsvModal } from "@/components/dashboard/ImportCsvModal";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useAuth } from "@/lib/auth";
import type { AccountResponse, NetWorthResponse, TransactionResponse } from "@/types/api";

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#4f46e5", "#7c3aed", "#9333ea",
  "#a855f7", "#d946ef",
];

interface HistoryPoint { date: string; net_worth: number; assets: number; liabilities: number; }
interface SpendingItem { category: string; total: number; }
interface SpendingData { expenses: SpendingItem[]; income_total: number; prior_total: number; }

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDisplayName(email: string): string {
  const local = email.split("@")[0];
  const name = local.replace(/[^a-zA-Z]/g, " ").trim().split(" ")[0];
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const { user } = useAuth();

  const { data: nw } = useSWR<NetWorthResponse>([netWorthKey(), refreshKey], ([k]) => apiFetcher(k));
  const { data: history } = useSWR<HistoryPoint[]>([netWorthHistoryKey(90), refreshKey], ([k]) => apiFetcher(k));
  const { data: accounts } = useSWR<AccountResponse[]>([accountsKey(), refreshKey], ([k]) => apiFetcher(k));
  const { data: spendingData } = useSWR<SpendingData>("/api/spending?days=30", apiFetcher, { refreshInterval: 30000, revalidateOnFocus: true });
  const spending = spendingData?.expenses ?? [];
  const { data: txnData } = useSWR(
    [transactionsKey({ limit: 5 }), refreshKey],
    ([k]) => fetch(k, { headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` } })
      .then(r => r.json()).then(b => b.data as TransactionResponse[])
  );

  const hasAccounts = Array.isArray(accounts) && accounts.length > 0;
  const totalSpending = spending.reduce((s, c) => s + c.total, 0);
  const incomeTotal = spendingData?.income_total ?? 0;
  const savingsRate = incomeTotal > 0 ? ((incomeTotal - totalSpending) / incomeTotal) * 100 : null;
  const nwPositive = (nw?.net_worth ?? 0) >= 0;

  const chartData = (history ?? []).map((p) => ({
    ...p,
    date: new Date(p.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const first = history?.[0]?.net_worth ?? 0;
  const last = history?.[history.length - 1]?.net_worth ?? 0;
  const nwChange = last - first;

  const nwSparkline = (history ?? []).slice(-14).map(p => p.net_worth);
  const savingsSparkline = nwSparkline.map((v, i, arr) => (i === 0 ? 0 : v - arr[i - 1]));

  if (!hasAccounts && accounts !== undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md">
          <EmptyState
            icon={<Wallet size={32} />}
            title="Welcome to your dashboard"
            description="Add your first account to see your complete financial picture — net worth, spending trends, and more."
            actionNode={<AddAccountModal label="Add Your First Account" onSuccess={refresh} />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Personalized greeting header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {user ? `${getGreeting()}, ${getDisplayName(user.email)}` : "Overview"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {incomeTotal > 0 && totalSpending > 0 && (
              <span className={`ml-2 font-medium ${incomeTotal >= totalSpending ? "text-emerald-500" : "text-rose-500"}`}>
                · {incomeTotal >= totalSpending
                  ? `${formatCurrency(incomeTotal - totalSpending)} saved this month`
                  : `${formatCurrency(totalSpending - incomeTotal)} over budget`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {hasAccounts && <ImportCsvModal accounts={accounts!} onSuccess={refresh} />}
          <AddAccountModal variant="outline" label="Add Account" onSuccess={refresh} />
        </div>
      </div>

      {/* Net worth equation */}
      <div className="rounded-2xl bg-white border card-base p-5 flex flex-col sm:flex-row items-stretch gap-0">
        {/* Net Worth */}
        <div className="flex-1 px-2 py-1 sm:pr-6">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net Worth</p>
          <p className="font-display text-4xl font-extrabold tracking-tight mt-1.5">
            <AnimatedNumber value={nw?.net_worth ?? 0} prefix="$" decimals={0} />
          </p>
          {history && history.length > 1 && (
            <p className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${nwChange >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
              {nwChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {nwChange >= 0 ? "+" : ""}{formatCurrency(nwChange)} past 90 days
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center text-2xl font-light text-muted-foreground/40 px-2">=</div>

        {/* Assets */}
        <div className="flex-1 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:px-6 py-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Assets</p>
          <p className="font-display text-2xl font-bold text-emerald-600 mt-1.5">
            <AnimatedNumber value={nw?.total_assets ?? 0} prefix="$" decimals={0} />
          </p>
        </div>

        <div className="hidden sm:flex items-center text-2xl font-light text-muted-foreground/40 px-2">−</div>

        {/* Liabilities */}
        <div className="flex-1 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:px-6 py-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Liabilities</p>
          <p className="font-display text-2xl font-bold text-rose-500 mt-1.5">
            <AnimatedNumber value={nw?.total_liabilities ?? 0} prefix="$" decimals={0} />
          </p>
        </div>
      </div>

      {/* Monthly snapshot */}
      {(incomeTotal > 0 || totalSpending > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border card-base stat-accent-emerald p-5 pb-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Income (30d)</p>
            <p className="font-display text-2xl font-bold text-emerald-600 mt-1.5">
              <AnimatedNumber value={incomeTotal} prefix="$" decimals={0} />
            </p>
            {nwSparkline.length > 2 && <div className="mt-3 -mx-1"><Sparkline data={nwSparkline} color="#10b981" /></div>}
          </div>
          <div className="rounded-2xl bg-white border card-base stat-accent-primary p-5 pb-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Spent (30d)</p>
            <p className="font-display text-2xl font-bold mt-1.5">
              <AnimatedNumber value={totalSpending} prefix="$" decimals={0} />
            </p>
            {spending.length > 1 && <div className="mt-3 -mx-1"><Sparkline data={spending.map(s => s.total)} color="#6366f1" /></div>}
          </div>
          <div className={`rounded-2xl bg-white border card-base p-5 pb-3 ${savingsRate !== null && savingsRate >= 0 ? "stat-accent-emerald" : "stat-accent-rose"}`}>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Savings Rate</p>
            {savingsRate !== null ? (
              <>
                <p className={`font-display text-2xl font-bold mt-1.5 ${savingsRate >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  <AnimatedNumber value={savingsRate} suffix="%" decimals={0} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(Math.abs(incomeTotal - totalSpending))} {incomeTotal >= totalSpending ? "saved" : "over budget"}
                </p>
                {savingsSparkline.length > 2 && <div className="mt-2 -mx-1"><Sparkline data={savingsSparkline} color={savingsRate >= 0 ? "#10b981" : "#f43f5e"} /></div>}
              </>
            ) : (
              <p className="font-display text-2xl font-bold text-muted-foreground mt-1.5">—</p>
            )}
          </div>
        </div>
      )}

      {/* Net worth chart */}
      {chartData.length > 1 && (
        <div className="rounded-2xl bg-white border card-base p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-semibold">Net Worth Trend</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Last 90 days</p>
            </div>
            <TrendingUp size={18} className="text-primary opacity-60" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3251" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), "Net Worth"]}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #1e3251", background: "#0d1b2e", color: "#e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}
                cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 2" }}
              />
              <Area type="monotone" dataKey="net_worth" stroke="#6366f1" strokeWidth={2.5} fill="url(#nwGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spending by category */}
        {spending.length > 0 && (
          <div className="rounded-2xl bg-white border card-base p-6">
            <div className="mb-4">
              <h2 className="font-display font-semibold">Spending This Month</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Total: {formatCurrency(totalSpending)}</p>
            </div>
            <div className="flex gap-5 items-center">
              {/* Donut with center label */}
              <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={spending}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {spending.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v)]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #1e3251", background: "#0d1b2e", color: "#e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xs text-muted-foreground leading-none">Total</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(totalSpending)}</p>
                </div>
              </div>
              {/* HTML legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {spending.slice(0, 6).map((item, i) => (
                  <div key={item.category} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="text-xs text-muted-foreground truncate flex-1">{item.category}</span>
                    <span className="text-xs font-semibold tabular-nums">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        <div className="rounded-2xl bg-white border card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Recent Transactions</h2>
            <a href="/dashboard/transactions" className="text-xs text-primary hover:underline">View all →</a>
          </div>
          {(txnData ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-1">
              {(txnData ?? []).map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 py-2 rounded-lg px-2 -mx-2 hover:bg-muted/40 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {(txn.merchant_name ?? txn.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate leading-tight">{txn.merchant_name ?? txn.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {txn.category?.[0] ?? "—"} · {new Date(txn.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${txn.amount < 0 ? "text-emerald-600" : ""}`}>
                    {txn.amount < 0 ? "+" : ""}{formatCurrency(Math.abs(txn.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accounts list */}
      {hasAccounts && (
        <div className="rounded-2xl bg-white border card-base p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Accounts</h2>
            <a href="/dashboard/accounts" className="text-xs text-primary hover:underline">Manage →</a>
          </div>
          <div className="divide-y">
            {accounts!.map((acct) => {
              const bal = acct.latest_balance?.current ?? 0;
              const isLiab = acct.type === "credit" || acct.type === "loan";
              return (
                <div key={acct.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                    <Wallet size={15} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{acct.name}</p>
                    <p className="text-xs text-muted-foreground">{acct.institution_name ?? acct.type}</p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${isLiab ? "text-rose-500" : ""}`}>
                    {isLiab ? "−" : ""}{formatCurrency(Math.abs(bal))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
