export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

interface SpendingItem { category: string; total: number; }

function aggregate(txns: { amount: number; category: string | string[] | null }[]): SpendingItem[] {
  const totals: Record<string, number> = {};
  for (const t of txns) {
    const cat = (Array.isArray(t.category) ? t.category[0] : t.category) ?? "Uncategorized";
    totals[cat] = (totals[cat] ?? 0) + Math.abs(parseFloat(String(t.amount)));
  }
  return Object.entries(totals)
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function dateStr(d: Date) { return d.toISOString().split("T")[0]; }

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam === "0" ? 0 : Math.max(1, parseInt(daysParam ?? "30"));
  const allTime = days === 0;

  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(now.getDate() - days);
  const priorCutoff = new Date(cutoff); priorCutoff.setDate(cutoff.getDate() - days);

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.sub);

  if (!accounts?.length) {
    return Response.json({ data: { expenses: [], income_total: 0, prior_total: 0 }, error: null });
  }

  const ids = accounts.map((a: { id: string }) => a.id);

  let expenseQ = supaAdmin.from("transactions").select("amount, category")
    .in("account_id", ids).gt("amount", 0).not("pending", "is", true);
  let incomeQ = supaAdmin.from("transactions").select("amount")
    .in("account_id", ids).lt("amount", 0).not("pending", "is", true);
  let priorQ = supaAdmin.from("transactions").select("amount")
    .in("account_id", ids).gt("amount", 0).not("pending", "is", true);

  if (!allTime) {
    expenseQ = expenseQ.gte("date", dateStr(cutoff));
    incomeQ  = incomeQ.gte("date", dateStr(cutoff));
    priorQ   = priorQ.gte("date", dateStr(priorCutoff)).lt("date", dateStr(cutoff));
  }

  const [{ data: expenseTxns }, { data: incomeTxns }, { data: priorTxns }] = await Promise.all([
    expenseQ, incomeQ, priorQ,
  ]);

  const expenses = aggregate(expenseTxns ?? []);

  const income_total = (incomeTxns ?? []).reduce(
    (s: number, t: { amount: number }) => s + Math.abs(parseFloat(String(t.amount))), 0
  );

  const prior_total = (priorTxns ?? []).reduce(
    (s: number, t: { amount: number }) => s + parseFloat(String(t.amount)), 0
  );

  return Response.json({
    data: {
      expenses,
      income_total: parseFloat(income_total.toFixed(2)),
      prior_total: parseFloat(prior_total.toFixed(2)),
    },
    error: null,
  });
}