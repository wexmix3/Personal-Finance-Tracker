export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: txn } = await supaAdmin
    .from("transactions")
    .select("account_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!txn) return Response.json({ data: null, error: "Transaction not found" }, { status: 404 });

  const { data: acct } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("id", txn.account_id)
    .eq("user_id", user.sub)
    .maybeSingle();
  if (!acct) return Response.json({ data: null, error: "Transaction not found" }, { status: 404 });

  await supaAdmin.from("transactions").delete().eq("id", params.id);
  return Response.json({ data: { deleted: true }, error: null });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { category } = await req.json();
  if (!category || typeof category !== "string") {
    return Response.json({ data: null, error: "category must be a non-empty string" }, { status: 400 });
  }

  const { data: txn } = await supaAdmin
    .from("transactions")
    .select("account_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!txn) return Response.json({ data: null, error: "Transaction not found" }, { status: 404 });

  const { data: acct } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("id", txn.account_id)
    .eq("user_id", user.sub)
    .maybeSingle();
  if (!acct) return Response.json({ data: null, error: "Transaction not found" }, { status: 404 });

  await supaAdmin
    .from("transactions")
    .update({ category: [category.trim()] })
    .eq("id", params.id);

  return Response.json({ data: { updated: true }, error: null });
}