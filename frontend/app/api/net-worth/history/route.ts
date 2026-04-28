export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Single join query — fetch all accounts with balance history in one shot.
  const { data: accounts, error } = await supaAdmin
    .from("accounts")
    .select("id, type, balances(current, snapshot_date, created_at)")
    .eq("user_id", user.sub);

  if (error || !accounts?.length) return Response.json({ data: [], error: null });

  const byDate: Record<string, { assets: number; liabilities: number }> = {};

  for (const acct of accounts) {
    const rows: { current: number; snapshot_date: string; created_at: string }[] = acct.balances ?? [];

    for (const b of rows) {
      const d = typeof b.snapshot_date === "string"
        ? b.snapshot_date
        : new Date(b.snapshot_date).toISOString().split("T")[0];

      if (d < cutoffStr) continue;

      if (!byDate[d]) byDate[d] = { assets: 0, liabilities: 0 };
      const val = parseFloat(String(b.current));

      if (acct.type === "credit" || acct.type === "loan") byDate[d].liabilities += Math.abs(val);
      else byDate[d].assets += val;
    }
  }

  const history = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { assets, liabilities }]) => ({
      date,
      net_worth: parseFloat((assets - liabilities).toFixed(2)),
      assets: parseFloat(assets.toFixed(2)),
      liabilities: parseFloat(liabilities.toFixed(2)),
    }));

  return Response.json({ data: history, error: null });
}