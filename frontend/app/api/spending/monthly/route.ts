export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export interface MonthlyPoint {
  month: string;   // "YYYY-MM"
  label: string;   // "Apr 2026"
  spent: number;
  income: number;
  net: number;
}

function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const monthsParam = req.nextUrl.searchParams.get("months");
  const months = Math.min(Math.max(parseInt(monthsParam ?? "12"), 1), 24);

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setDate(1);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.sub);

  if (!accounts?.length) {
    return Response.json({ data: [], error: null });
  }

  const ids = accounts.map((a: { id: string }) => a.id);

  const { data: txns } = await supaAdmin
    .from("transactions")
    .select("date, amount")
    .in("account_id", ids)
    .not("pending", "is", true)
    .gte("date", cutoffStr)
    .order("date", { ascending: true });

  // Aggregate by month
  const byMonth: Record<string, { spent: number; income: number }> = {};
  for (const t of txns ?? []) {
    const ym = toYearMonth(t.date as string);
    if (!byMonth[ym]) byMonth[ym] = { spent: 0, income: 0 };
    const amount = parseFloat(String(t.amount));
    if (amount > 0) byMonth[ym].spent += amount;
    else byMonth[ym].income += Math.abs(amount);
  }

  const result: MonthlyPoint[] = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, { spent, income }]) => ({
      month: ym,
      label: monthLabel(ym),
      spent: parseFloat(spent.toFixed(2)),
      income: parseFloat(income.toFixed(2)),
      net: parseFloat((income - spent).toFixed(2)),
    }));

  return Response.json({ data: result, error: null });
}
