"use client";

import { useState, useCallback, useRef } from "react";
import useSWR from "swr";
import { Search, Trash2, ChevronDown, Eraser, Wand2, Plus, X } from "lucide-react";
import { transactionsKey, apiFetcher, deleteTransaction, accountsKey, apiPatch, apiDelete, apiPost } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { ImportCsvModal } from "@/components/dashboard/ImportCsvModal";
import { formatCurrency } from "@/lib/utils";
import type { AccountResponse, ApiResponse, TransactionResponse } from "@/types/api";

const PAGE_SIZE = 25;

const COMMON_CATEGORIES = [
  "Food & Drink", "Groceries", "Restaurants", "Shopping", "Transportation",
  "Gas & Fuel", "Entertainment", "Health & Fitness", "Travel", "Utilities",
  "Housing", "Personal Care", "Insurance", "Subscriptions", "Education",
  "Income", "Transfer", "Uncategorized",
];

async function fetchTxns(key: string) {
  const token = getStoredToken();
  const res = await fetch(key, { headers: { Authorization: `Bearer ${token ?? ""}` } });
  const body: ApiResponse<TransactionResponse[]> = await res.json();
  return { items: body.data ?? [], total: body.meta?.total ?? 0 };
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [clearing, setClearing] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const selectRef = useRef<HTMLSelectElement>(null);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const { data: accounts } = useSWR<AccountResponse[]>([accountsKey(), refreshKey], ([k]) => apiFetcher(k));
  const { data: allCategories } = useSWR<string[]>("/api/transactions/categories", apiFetcher);
  type Rule = { id: string; pattern: string; category: string };
  const { data: rules, mutate: mutateRules } = useSWR<Rule[]>(
    "/api/categorization-rules", apiFetcher
  );

  const swrKey = transactionsKey({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: debouncedSearch || undefined, category: categoryFilter || undefined });
  const { data, isLoading } = useSWR([swrKey, refreshKey], ([k]) => fetchTxns(k), { keepPreviousData: true });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Collect unique categories from current page for the dropdown
  const pageCategories = Array.from(new Set(items.flatMap(t => t.category ?? []).filter(Boolean)));
  const categoryOptions = Array.from(new Set([...COMMON_CATEGORIES, ...pageCategories])).sort();

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(0);
    clearTimeout((window as unknown as { _st: number })._st);
    (window as unknown as { _st: number })._st = window.setTimeout(() => setDebouncedSearch(e.target.value), 300);
  }

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    refresh();
  }

  async function handleClearAll() {
    if (!confirm(`Delete all ${total} transactions? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await apiDelete("/api/transactions");
      refresh();
    } finally {
      setClearing(false);
    }
  }

  function startEdit(txn: TransactionResponse) {
    setEditingId(txn.id);
    setEditingValue(txn.category?.[0] ?? "Uncategorized");
    // Focus the select on the next tick after it renders
    setTimeout(() => selectRef.current?.focus(), 0);
  }

  async function handleRecategorize() {
    setRecategorizing(true);
    try {
      await apiPost("/api/transactions/recategorize", {});
      refresh();
    } finally {
      setRecategorizing(false);
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newPattern.trim() || !newCategory.trim()) return;
    await apiPost("/api/categorization-rules", { pattern: newPattern.trim(), category: newCategory.trim() });
    setNewPattern("");
    setNewCategory("");
    mutateRules();
  }

  async function handleDeleteRule(id: string) {
    await apiDelete(`/api/categorization-rules/${id}`);
    mutateRules();
  }

  async function commitEdit(id: string, value: string) {
    setEditingId(null);
    if (!value) return;
    try {
      await apiPatch(`/api/transactions/${id}`, { category: value });
      refresh();
    } catch {
      // silent — the old value stays visible until next refresh
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total transactions</p>
        </div>
        <div className="flex gap-2">
          {total > 0 && (
            <button
              onClick={handleRecategorize}
              disabled={recategorizing}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
              title="Apply categorization rules to all transactions"
            >
              <Wand2 size={13} />
              {recategorizing ? "Applying…" : "Auto-categorize"}
            </button>
          )}
          <button
            onClick={() => setShowRules(r => !r)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${showRules ? "bg-primary text-white border-primary" : "text-muted-foreground hover:text-primary hover:border-primary"}`}
          >
            Rules {rules?.length ? `(${rules.length})` : ""}
          </button>
          {total > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
            >
              <Eraser size={13} />
              {clearing ? "Clearing…" : "Clear all"}
            </button>
          )}
          {Array.isArray(accounts) && accounts.length > 0 && (
            <ImportCsvModal accounts={accounts} onSuccess={refresh} />
          )}
        </div>
      </div>

      {/* Rules panel */}
      {showRules && (
        <div className="rounded-2xl bg-white border p-5 space-y-4">
          <p className="text-sm font-semibold">Auto-categorization Rules</p>
          <p className="text-xs text-muted-foreground -mt-2">Merchant names containing the pattern (case-insensitive) get the assigned category. Applied automatically on import and via Auto-categorize.</p>

          <form onSubmit={handleAddRule} className="flex gap-2">
            <input
              className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Pattern (e.g. trader joe)"
              value={newPattern}
              onChange={e => setNewPattern(e.target.value)}
            />
            <select
              className="rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            >
              <option value="">Category…</option>
              {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              type="submit"
              disabled={!newPattern.trim() || !newCategory}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus size={13} /> Add
            </button>
          </form>

          {rules?.length ? (
            <div className="divide-y rounded-xl border overflow-hidden">
              {rules.map(r => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm bg-white hover:bg-muted/20">
                  <span className="text-muted-foreground font-mono text-xs">{r.pattern}</span>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-primary font-medium">{r.category}</span>
                    <button onClick={() => handleDeleteRule(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No rules yet — add one above.</p>
          )}
        </div>
      )}

      {/* Search + category filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-xl border bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search transactions…"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
            className="appearance-none rounded-xl border bg-white pl-3 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-muted-foreground"
          >
            <option value="">All categories</option>
            {(allCategories ?? COMMON_CATEGORIES).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border overflow-hidden">
        {isLoading && items.length === 0 ? (
          <div className="space-y-3 p-6">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground text-sm">
              {debouncedSearch ? `No results for "${debouncedSearch}"` : "No transactions yet — import a CSV from your bank"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-left font-medium">Description</th>
                <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Category</th>
                <th className="px-5 py-3 text-left font-medium hidden lg:table-cell">Account</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((txn) => {
                const isUncategorized = !txn.category?.[0] || txn.category[0] === "Uncategorized";
                return (
                <tr key={txn.id} className={`transition-colors group ${isUncategorized ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-muted/20"}`}>
                  <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(txn.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium truncate max-w-[180px]">{txn.merchant_name ?? txn.name}</p>
                    {txn.pending && <span className="text-xs text-amber-500">Pending</span>}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    {editingId === txn.id ? (
                      <select
                        ref={selectRef}
                        className="rounded-full border border-primary bg-white px-2.5 py-0.5 text-xs text-primary font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onBlur={() => commitEdit(txn.id, editingValue)}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitEdit(txn.id, editingValue);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      >
                        {categoryOptions.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : txn.category?.[0] && txn.category[0] !== "Uncategorized" ? (
                      <button
                        onClick={() => startEdit(txn)}
                        title="Click to edit category"
                        className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-primary font-medium hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        {txn.category[0]}
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(txn)}
                        title="Click to categorize"
                        className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-700 font-medium hover:bg-amber-200 transition-colors cursor-pointer"
                      >
                        Uncategorized
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[120px]">
                    {txn.account_name}
                  </td>
                  <td className={`px-5 py-3 text-right font-semibold tabular-nums ${txn.amount < 0 ? "text-emerald-600" : ""}`}>
                    {txn.amount < 0 ? "+" : ""}{formatCurrency(Math.abs(txn.amount))}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleDelete(txn.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-muted transition-colors">Previous</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-muted transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}