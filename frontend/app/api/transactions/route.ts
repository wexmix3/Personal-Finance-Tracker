export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

async function getUserAccountIds(userId: string): Promise<string[]> {
  const { data } = await supaAdmin.from("accounts").select("id").eq("user_id", userId);
  return (data ?? []).map((a: { id: string }) => a.id);
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 200);
  const offset = parseInt(sp.get("offset") ?? "0");
  const search = sp.get("search") ?? "";
  const account_id = sp.get("account_id");
  const pending = sp.get("pending");
  const category = sp.get("category");

  const accountIds = await getUserAccountIds(user.sub);
  if (!accountIds.length) return Response.json({ data: [], error: null, meta: { total: 0, limit, offset } });

  const filterIds = account_id ? [account_id] : accountIds;

  let q = supaAdmin
    .from("transactions")
    .select("id, name, merchant_name, amount, currency, category, date, pending, created_at, account_id, accounts(name)", { count: "exact" })
    .in("account_id", filterIds)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) q = q.or(`name.ilike.%${search}%,merchant_name.ilike.%${search}%`);
  if (pending != null) q = q.eq("pending", pending === "true");
  if (category) q = q.contains("category", [category]);

  const { data, count } = await q;

  const rows = (data ?? []).map((r: { accounts: { name: string } | null; amount: number; [key: string]: unknown }) => ({
    ...r,
    account_name: r.accounts ? (r.accounts as { name: string }).name : null,
    accounts: undefined,
    amount: parseFloat(String(r.amount)),
  }));

  return Response.json({ data: rows, error: null, meta: { total: count ?? 0, limit, offset } });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const { account_id, name, merchant_name, amount, date, category, pending = false, currency = "USD" } = await req.json();

    const { data: acct } = await supaAdmin
      .from("accounts")
      .select("id")
      .eq("id", account_id)
      .eq("user_id", user.sub)
      .maybeSingle();
    if (!acct) return Response.json({ data: null, error: "Account not found" }, { status: 404 });

    const { data: txn } = await supaAdmin
      .from("transactions")
      .insert({ account_id, name: name.trim(), merchant_name: merchant_name?.trim() || null, amount, date, category: category || null, pending, currency: currency.toUpperCase() })
      .select("id")
      .single();

    return Response.json({ data: { id: txn?.id, created: true }, error: null }, { status: 201 });
  } catch (err) {
    console.error("create txn error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const accountIds = await getUserAccountIds(user.sub);
  if (!accountIds.length) return Response.json({ data: { deleted: 0 }, error: null });

  const { count } = await supaAdmin
    .from("transactions")
    .delete({ count: "exact" })
    .in("account_id", accountIds);

  return Response.json({ data: { deleted: count ?? 0 }, error: null });
}