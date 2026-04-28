export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90");

  // Investment accounts only
  const { data: accounts, error } = await supaAdmin
    .from("accounts")
    .select("id, name, institution_name, subtype")
    .eq("user_id", user.sub)
    .eq("type", "investment")
    .order("name");

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
  if (!accounts?.length) return Response.json({ data: { accounts: [], portfolio_value: 0, portfolio_cost: 0, total_change: 0, total_change_pct: 0 }, error: null });

  const ids = accounts.map((a: { id: string }) => a.id);

  // 90-day balance history for all investment accounts
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const { data: balances } = await supaAdmin
    .from("balances")
    .select("account_id, current, snapshot_date")
    .in("account_id", ids)
    .gte("snapshot_date", cutoffStr)
    .order("snapshot_date", { ascending: true });

  // Also get the very first balance snapshot per account (for cost basis)
  const { data: firstBalances } = await supaAdmin
    .from("balances")
    .select("account_id, current, snapshot_date")
    .in("account_id", ids)
    .order("snapshot_date", { ascending: true });

  // Group history by account_id
  const historyByAccount: Record<string, { date: string; value: number }[]> = {};
  for (const b of balances ?? []) {
    if (!historyByAccount[b.account_id]) historyByAccount[b.account_id] = [];
    historyByAccount[b.account_id].push({
      date: b.snapshot_date,
      value: parseFloat(String(b.current ?? 0)),
    });
  }

  // First snapshot per account (earliest ever recorded)
  const firstByAccount: Record<string, number> = {};
  for (const b of firstBalances ?? []) {
    if (firstByAccount[b.account_id] === undefined) {
      firstByAccount[b.account_id] = parseFloat(String(b.current ?? 0));
    }
  }

  // Latest snapshot per account
  const latestByAccount: Record<string, number> = {};
  for (const b of balances ?? []) {
    latestByAccount[b.account_id] = parseFloat(String(b.current ?? 0));
  }

  type AccountRow = { id: string; name: string; institution_name: string | null; subtype: string | null };

  const result = (accounts as AccountRow[]).map(a => {
    const current = latestByAccount[a.id] ?? 0;
    const cost = firstByAccount[a.id] ?? current;
    const change = current - cost;
    const change_pct = cost > 0 ? (change / cost) * 100 : 0;
    return {
      id: a.id,
      name: a.name,
      institution_name: a.institution_name,
      subtype: a.subtype,
      current_balance: parseFloat(current.toFixed(2)),
      first_balance: parseFloat(cost.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      history: historyByAccount[a.id] ?? [],
    };
  });

  const portfolio_value = result.reduce((s, a) => s + a.current_balance, 0);
  const portfolio_cost = result.reduce((s, a) => s + a.first_balance, 0);
  const total_change = portfolio_value - portfolio_cost;
  const total_change_pct = portfolio_cost > 0 ? (total_change / portfolio_cost) * 100 : 0;

  return Response.json({
    data: {
      portfolio_value: parseFloat(portfolio_value.toFixed(2)),
      portfolio_cost: parseFloat(portfolio_cost.toFixed(2)),
      total_change: parseFloat(total_change.toFixed(2)),
      total_change_pct: parseFloat(total_change_pct.toFixed(2)),
      accounts: result,
    },
    error: null,
  });
}