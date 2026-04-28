export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

function dateStr(d: Date) { return d.toISOString().split("T")[0]; }

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam === "0" ? 0 : Math.max(1, parseInt(daysParam ?? "30"));
  const allTime = days === 0;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.sub);

  if (!accounts?.length) {
    return Response.json({ data: { items: [], total: 0 }, error: null });
  }

  const ids = accounts.map((a: { id: string }) => a.id);

  let q = supaAdmin
    .from("transactions")
    .select("id, name, merchant_name, amount, date, category, account_id, accounts(name)", { count: "exact" })
    .in("account_id", ids)
    .lt("amount", 0)
    .not("pending", "is", true)
    .order("date", { ascending: false });

  if (!allTime) {
    q = q.gte("date", dateStr(cutoff));
  }

  const { data, count } = await q;

  const items = (data ?? []).map((r: { accounts: { name: string } | null; amount: number; [key: string]: unknown }) => ({
    ...r,
    account_name: r.accounts ? (r.accounts as { name: string }).name : null,
    accounts: undefined,
    amount: parseFloat(String(r.amount)),
  }));

  const total = items.reduce((s: number, t: { amount: number }) => s + Math.abs(t.amount), 0);

  return Response.json({
    data: { items, total: parseFloat(total.toFixed(2)), count: count ?? 0 },
    error: null,
  });
}
