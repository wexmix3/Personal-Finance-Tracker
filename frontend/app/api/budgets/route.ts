export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const debug = req.nextUrl.searchParams.get("debug") === "true";

  // Budgets for this user
  const { data: budgets, error } = await supaAdmin
    .from("budgets")
    .select("id, category, monthly_limit, created_at")
    .eq("user_id", user.sub)
    .order("category");

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });

  if (!budgets?.length) return Response.json({ data: [], error: null });

  // Current month's spending per category
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.sub);

  const ids = (accounts ?? []).map((a: { id: string }) => a.id);

  // Fetch ALL non-pending expense transactions for the current month.
  // Use .not("pending", "is", true) (matches false AND null) to be consistent
  // with the spending API and avoid missing manually-imported transactions.
  const { data: txns } = ids.length
    ? await supaAdmin
        .from("transactions")
        .select("id, amount, category, date, name")
        .in("account_id", ids)
        .gt("amount", 0)
        .not("pending", "is", true)
        .gte("date", monthStart)
    : { data: [] };

  // Aggregate spending + count by category
  const spending: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const debugTxns: { id: string; name: string; date: string; amount: number; category: string }[] = [];

  for (const t of txns ?? []) {
    const cat = (Array.isArray(t.category) ? t.category[0] : t.category) ?? "Uncategorized";
    spending[cat] = (spending[cat] ?? 0) + parseFloat(String(t.amount));
    counts[cat] = (counts[cat] ?? 0) + 1;
    if (debug) {
      debugTxns.push({ id: t.id, name: t.name, date: t.date, amount: parseFloat(String(t.amount)), category: cat });
    }
  }

  const data = budgets.map((b: { id: string; category: string; monthly_limit: number; created_at: string }) => {
    const spent = parseFloat((spending[b.category] ?? 0).toFixed(2));
    const limit = parseFloat(String(b.monthly_limit));
    return {
      id: b.id,
      category: b.category,
      monthly_limit: limit,
      spent,
      remaining: parseFloat((limit - spent).toFixed(2)),
      pct_used: limit > 0 ? parseFloat(((spent / limit) * 100).toFixed(1)) : 0,
      transaction_count: counts[b.category] ?? 0,
    };
  });

  if (debug) {
    return Response.json({
      data,
      debug: {
        month_start: monthStart,
        account_ids: ids,
        total_expense_txns: txns?.length ?? 0,
        spending_by_category: spending,
        counts_by_category: counts,
        transactions: debugTxns.sort((a, b) => b.amount - a.amount),
      },
      error: null,
    });
  }

  return Response.json({ data, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { category, monthly_limit } = await req.json();
  if (!category || typeof category !== "string" || category.trim() === "") {
    return Response.json({ data: null, error: "category is required" }, { status: 400 });
  }
  const limit = parseFloat(monthly_limit);
  if (isNaN(limit) || limit <= 0) {
    return Response.json({ data: null, error: "monthly_limit must be a positive number" }, { status: 400 });
  }

  const { data, error } = await supaAdmin
    .from("budgets")
    .upsert(
      { user_id: user.sub, category: category.trim(), monthly_limit: limit },
      { onConflict: "user_id,category" }
    )
    .select("id, category, monthly_limit")
    .single();

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
  return Response.json({ data, error: null }, { status: 201 });
}
