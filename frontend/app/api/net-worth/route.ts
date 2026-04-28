export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  // Single join query — fetch all accounts with their balance rows in one shot.
  // The two-step approach (fetch accounts → fetch balances with .in()) was
  // returning incomplete results for unknown reasons; this is simpler and reliable.
  const { data: accounts, error } = await supaAdmin
    .from("accounts")
    .select("id, type, balances(current, created_at)")
    .eq("user_id", user.sub);

  if (error || !accounts?.length)
    return Response.json({ data: { net_worth: 0, total_assets: 0, total_liabilities: 0 }, error: null });

  let assets = 0, liabilities = 0;

  for (const acct of accounts) {
    const rows: { current: number; created_at: string }[] = acct.balances ?? [];
    if (!rows.length) continue;

    // Pick the most recent balance row by created_at
    const latest = rows.reduce((best: { current: number; created_at: string }, b: { current: number; created_at: string }) =>
      b.created_at > best.created_at ? b : best
    );
    const val = parseFloat(String(latest.current));

    if (acct.type === "credit" || acct.type === "loan") liabilities += Math.abs(val);
    else assets += val;
  }

  return Response.json({
    data: {
      net_worth: parseFloat((assets - liabilities).toFixed(2)),
      total_assets: parseFloat(assets.toFixed(2)),
      total_liabilities: parseFloat(liabilities.toFixed(2)),
    },
    error: null,
  });
}