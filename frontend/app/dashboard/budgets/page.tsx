"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Plus, Trash2, AlertTriangle, Target } from "lucide-react";
import { apiFetcher, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

const COMMON_CATEGORIES = [
  "Food & Drink", "Groceries", "Restaurants", "Shopping", "Transportation",
  "Gas & Fuel", "Entertainment", "Health & Fitness", "Travel", "Utilities",
  "Housing", "Personal Care", "Insurance", "Subscriptions", "Education",
  "Uncategorized",
];

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  spent: number;
  remaining: number;
  pct_used: number;
}

function progressColor(pct: number) {
  if (pct >= 100) return "bg-rose-500";
  if (pct >= 80) return "bg-amber-400";
  return "bg-emerald-500";
}

function progressText(pct: number) {
  if (pct >= 100) return "text-rose-600";
  if (pct >= 80) return "text-amber-600";
  return "text-emerald-600";
}

function AddBudgetModal({ existingCategories, onSuccess }: { existingCategories: string[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const usedCategories = new Set(existingCategories);
  const available = COMMON_CATEGORIES.filter(c => !usedCategories.has(c));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cat = category === "__custom__" ? customCategory.trim() : category;
    if (!cat) { setError("Select or enter a category"); return; }
    const lim = parseFloat(limit);
    if (isNaN(lim) || lim <= 0) { setError("Enter a valid monthly limit"); return; }

    setSaving(true);
    setError("");
    try {
      await apiPost("/api/budgets", { category: cat, monthly_limit: lim });
      setOpen(false);
      setCategory("");
      setCustomCategory("");
      setLimit("");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
      >
        <Plus size={16} />
        New Budget
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4"
      >
        <h2 className="font-semibold text-lg">New Monthly Budget</h2>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <select
            className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={category}
            onChange={e => setCategory(e.target.value)}
            required
          >
            <option value="">Select a category…</option>
            {available.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">+ Custom category…</option>
          </select>
        </div>

        {category === "__custom__" && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Custom Category Name</label>
            <input
              className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Date Night"
              value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              required
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Monthly Limit</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              className="w-full rounded-xl border bg-white pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="500"
              type="number"
              min="1"
              step="1"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              required
            />
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
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Budget"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BudgetsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: budgets, isLoading } = useSWR<Budget[]>(
    ["/api/budgets", refreshKey],
    ([k]) => apiFetcher(k),
  );

  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  async function handleDelete(id: string) {
    await apiDelete(`/api/budgets/${id}`);
    refresh();
  }

  async function handleEditSave(id: string) {
    const lim = parseFloat(editValue);
    if (!isNaN(lim) && lim > 0) {
      await apiPatch(`/api/budgets/${id}`, { monthly_limit: lim });
      refresh();
    }
    setEditingId(null);
  }

  const overBudgetCount = (budgets ?? []).filter(b => b.pct_used >= 100).length;
  const nearLimitCount = (budgets ?? []).filter(b => b.pct_used >= 80 && b.pct_used < 100).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthName}</p>
        </div>
        <AddBudgetModal
          existingCategories={(budgets ?? []).map(b => b.category)}
          onSuccess={refresh}
        />
      </div>

      {/* Alerts */}
      {overBudgetCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3">
          <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
          <p className="text-sm text-rose-400 font-medium">
            {overBudgetCount} {overBudgetCount === 1 ? "category is" : "categories are"} over budget this month
          </p>
        </div>
      )}
      {!overBudgetCount && nearLimitCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-400 font-medium">
            {nearLimitCount} {nearLimitCount === 1 ? "category is" : "categories are"} approaching the limit
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl bg-white border animate-pulse" />)}
        </div>
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState
          icon={<Target size={28} />}
          title="No budgets yet"
          description="Set monthly spending limits by category. The app will track your actual spending against each budget automatically."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map(b => (
            <div key={b.id} className="rounded-2xl bg-white border p-5 space-y-3 group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{b.category}</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-bold">{formatCurrency(b.spent)}</span>
                    <span className="text-xs text-muted-foreground">
                      of{" "}
                      {editingId === b.id ? (
                        <input
                          className="inline-block w-20 rounded border px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          type="number"
                          min="1"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => handleEditSave(b.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleEditSave(b.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingId(b.id); setEditValue(String(b.monthly_limit)); }}
                          className="underline decoration-dashed underline-offset-2 hover:text-primary transition-colors"
                          title="Click to edit limit"
                        >
                          {formatCurrency(b.monthly_limit)}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${progressText(b.pct_used)}`}>
                    {b.pct_used}%
                  </span>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(b.pct_used)}`}
                  style={{ width: `${Math.min(b.pct_used, 100)}%` }}
                />
              </div>

              <p className={`text-xs font-medium ${b.remaining >= 0 ? "text-muted-foreground" : "text-rose-500"}`}>
                {b.remaining >= 0
                  ? `${formatCurrency(b.remaining)} remaining`
                  : `${formatCurrency(Math.abs(b.remaining))} over budget`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}