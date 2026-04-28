export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: acct } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.sub)
    .maybeSingle();
  if (!acct) return Response.json({ data: null, error: "Account not found" }, { status: 404 });

  const { name, institution_name, current_balance } = await req.json();

  if (name != null || institution_name != null) {
    const update: Record<string, string> = {};
    if (name != null) update.name = name.trim();
    if (institution_name != null) update.institution_name = institution_name.trim();
    await supaAdmin.from("accounts").update(update).eq("id", params.id);
  }

  if (current_balance != null) {
    // Each manual update is a new timestamped record — full history preserved
    await supaAdmin.from("balances").insert({
      account_id: params.id,
      current: current_balance,
      snapshot_date: new Date().toISOString().split("T")[0],
    });
  }

  return Response.json({ data: { id: params.id, updated: true }, error: null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { action } = await req.json();
  if (action !== "flip_amounts") return Response.json({ data: null, error: "Unknown action" }, { status: 400 });

  const { data: acct } = await supaAdmin
    .from("accounts").select("id").eq("id", params.id).eq("user_id", user.sub).maybeSingle();
  if (!acct) return Response.json({ data: null, error: "Account not found" }, { status: 404 });

  const { data: txns } = await supaAdmin
    .from("transactions").select("id, amount").eq("account_id", params.id);

  let updated = 0;
  for (const t of txns ?? []) {
    await supaAdmin.from("transactions")
      .update({ amount: -(parseFloat(String(t.amount))) })
      .eq("id", t.id);
    updated++;
  }

  return Response.json({ data: { updated }, error: null });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: acct } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.sub)
    .maybeSingle();
  if (!acct) return Response.json({ data: null, error: "Account not found" }, { status: 404 });

  await supaAdmin.from("accounts").delete().eq("id", params.id);
  return Response.json({ data: { deleted: true }, error: null });
}