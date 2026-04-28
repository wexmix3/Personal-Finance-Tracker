export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id, name, institution_name, type, subtype, created_at")
    .eq("user_id", user.sub)
    .order("created_at");

  if (!accounts?.length) return Response.json({ data: [], error: null });

  const ids = accounts.map((a: { id: string }) => a.id);
  const { data: balances } = await supaAdmin
    .from("balances")
    .select("account_id, current, available, snapshot_date, iso_currency_code, created_at")
    .in("account_id", ids)
    .order("created_at", { ascending: false });

  const latestBalance: Record<string, unknown> = {};
  for (const b of balances ?? []) {
    if (!latestBalance[b.account_id]) latestBalance[b.account_id] = b;
  }

  const result = accounts.map((a: { id: string; name: string; institution_name: string; type: string; subtype: string }) => {
    const b = latestBalance[a.id] as { current: number; available: number | null; snapshot_date: string; iso_currency_code: string; created_at: string } | undefined;
    return {
      id: a.id,
      name: a.name,
      institution_name: a.institution_name,
      type: a.type,
      subtype: a.subtype,
      latest_balance: b ? {
        current: parseFloat(String(b.current)),
        available: b.available != null ? parseFloat(String(b.available)) : null,
        snapshot_date: b.snapshot_date,
        iso_currency_code: b.iso_currency_code,
        updated_at: b.created_at,
      } : null,
    };
  });

  return Response.json({ data: result, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const { name, institution_name, type, subtype, current_balance, currency = "USD" } = await req.json();
    const VALID_TYPES = ["depository", "credit", "investment", "loan", "other"];
    if (!VALID_TYPES.includes(type))
      return Response.json({ data: null, error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 422 });

    const { data: acct, error } = await supaAdmin
      .from("accounts")
      .insert({ user_id: user.sub, name: name.trim(), institution_name: institution_name?.trim() || null, type, subtype: subtype || null })
      .select("id")
      .single();

    if (error || !acct)
      return Response.json({ data: null, error: `Failed to create account: ${error?.message}` }, { status: 500 });

    await supaAdmin.from("balances").insert({
      account_id: acct.id,
      current: current_balance,
      available: type !== "credit" ? current_balance : null,
      iso_currency_code: currency.toUpperCase(),
      snapshot_date: new Date().toISOString().split("T")[0],
    });

    return Response.json({ data: { id: acct.id, name, institution_name, type, subtype, current_balance }, error: null }, { status: 201 });
  } catch (err) {
    console.error("create account error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}