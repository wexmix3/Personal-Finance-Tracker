"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { Pencil, Trash2, Wallet, CreditCard, TrendingUp, Landmark, ArrowLeftRight, Bug } from "lucide-react";
import { apiFetcher, accountsKey, deleteAccount, updateAccountBalance, apiPost } from "@/lib/api";
import { AddAccountModal } from "@/components/dashboard/AddAccountModal";
import { ImportCsvModal } from "@/components/dashboard/ImportCsvModal";
import { ConnectBankButton } from "@/components/dashboard/ConnectBankButton";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AccountResponse } from "@/types/api";

interface DebugInfo {
  accounts: { id: string; name: string; type: string }[];
  total_transactions: number;
  positive_amount: number;
  pending_false: number;
  within_last_30d: number;
  sample_transactions: { id: string; amount: number; pending: boolean; date: string; category: string[] | null }[];
}

function DebugPanel() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR<DebugInfo>(open ? "/api/debug" : null, apiFetcher);

  return (
    <div className="rounded-2xl bg-white border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <Bug size={14} /> Data Diagnostics {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-3 border-t">
          {isLoading ? <p className="text-xs text-muted-foreground pt-3">Loading…</p> : !data ? (
            <p className="text-xs text-rose-500 pt-3">Failed to load — are you logged in?</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 pt-3">
                {[
                  ["Total txns", data.total_transactions],
                  ["Positive (expense)", data.positive_amount],
                  ["Pending=false", data.pending_false],
                  ["Last 30d", data.within_last_30d],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl border p-3 text-center">
                    <p className="text-lg font-bold">{val}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              {data.positive_amount === 0 && data.total_transactions > 0 && (
                <p className="text-xs text-rose-500 font-medium">
                  ⚠ All amounts are negative — spending tab shows nothing. Use the ⇄ flip button on your account to fix.
                </p>
              )}
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted/40 border-b">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Raw amount</th>
                    <th className="px-3 py-2 text-left font-medium">Pending</th>
                    <th className="px-3 py-2 text-left font-medium">Category</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {(data.sample_transactions ?? []).map(t => (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5">{t.date}</td>
                        <td className={`px-3 py-1.5 font-mono font-semibold ${t.amount > 0 ? "text-emerald-600" : "text-rose-500"}`}>{t.amount}</td>
                        <td className="px-3 py-1.5">{String(t.pending)}</td>
                        <td className="px-3 py-1.5">{t.category?.join(", ") ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  depository: <Landmark size={16} className="text-primary" />,
  credit: <CreditCard size={16} className="text-rose-500" />,
  investment: <TrendingUp size={16} className="text-emerald-500" />,
  loan: <CreditCard size={16} className="text-amber-500" />,
};

function UpdateBalanceModal({ acct, onDone }: { acct: AccountResponse; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(String(acct.latest_balance?.current ?? ""));
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await updateAccountBalance(acct.id, parseFloat(val));
    setLoading(false);
    setOpen(false);
    onDone();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors">
        <Pencil size={14} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white shadow-xl border">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">Update Balance — {acct.name}</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground text-xl leading-none">×</button>
            </div>
            <form onSubmit={submit} className="px-5 py-4 space-y-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input required type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
                  className="w-full rounded-xl border pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={loading}
                  className="flex-1 rounded-xl bg-primary text-white py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {loading ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const TYPE_ORDER = ["depository", "investment", "credit", "loan", "other"];

export default function AccountsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  const { data: accounts } = useSWR<AccountResponse[]>([accountsKey(), refreshKey], ([k]) => apiFetcher(k));

  const byType = TYPE_ORDER.reduce<Record<string, AccountResponse[]>>((acc, t) => {
    acc[t] = (accounts ?? []).filter(a => a.type === t);
    return acc;
  }, {});

  const TYPE_LABELS: Record<string, string> = {
    depository: "Bank Accounts", credit: "Credit Cards",
    investment: "Investments", loan: "Loans", other: "Other",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{accounts?.length ?? 0} accounts linked</p>
        </div>
        <div className="flex gap-2">
          {Array.isArray(accounts) && accounts.length > 0 && (
            <ImportCsvModal accounts={accounts} onSuccess={refresh} />
          )}
          <ConnectBankButton onSuccess={refresh} />
          <AddAccountModal variant="default" label="Add Account" onSuccess={refresh} />
        </div>
      </div>

      {(!accounts || accounts.length === 0) ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title="No accounts yet"
          description="Connect your bank automatically via Plaid, or add an account manually."
          actionNode={
            <div className="flex flex-wrap gap-2 justify-center">
              <ConnectBankButton onSuccess={refresh} variant="empty-state" />
              <AddAccountModal label="Add Manually" onSuccess={refresh} />
            </div>
          }
        />
      ) : (
        TYPE_ORDER.filter(t => byType[t].length > 0).map(type => (
          <div key={type} className="rounded-2xl bg-white border overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30">
              <h2 className="text-sm font-semibold">{TYPE_LABELS[type]}</h2>
            </div>
            <div className="divide-y">
              {byType[type].map(acct => {
                const bal = acct.latest_balance?.current ?? 0;
                const isLiab = acct.type === "credit" || acct.type === "loan";
                return (
                  <div key={acct.id} className="flex items-center gap-4 px-5 py-4 group">
                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                      {TYPE_ICONS[acct.type] ?? <Wallet size={16} className="text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{acct.name}</p>
                      <p className="text-xs text-muted-foreground">{acct.institution_name ?? acct.subtype ?? acct.type}</p>
                      {acct.latest_balance?.updated_at && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          Updated {new Date(acct.latest_balance.updated_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${isLiab ? "text-rose-500" : "text-foreground"}`}>
                      {isLiab ? "−" : ""}{formatCurrency(Math.abs(bal))}
                    </p>
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <UpdateBalanceModal acct={acct} onDone={refresh} />
                      <button
                        onClick={async () => {
                          if (!confirm(`Flip all transaction amounts for "${acct.name}"? Use this if purchases show as negative.`)) return;
                          await apiPost(`/api/accounts/${acct.id}`, { action: "flip_amounts" });
                          refresh();
                        }}
                        title="Flip transaction amounts (fix imports where purchases are negative)"
                        className="text-muted-foreground hover:text-amber-500 transition-colors"
                      >
                        <ArrowLeftRight size={14} />
                      </button>
                      <button onClick={async () => { await deleteAccount(acct.id); refresh(); }}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <DebugPanel />
    </div>
  );
}