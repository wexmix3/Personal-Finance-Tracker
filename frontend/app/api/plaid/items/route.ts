export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: items, error } = await supaAdmin
    .from("plaid_items")
    .select("id, institution_name, item_id, created_at")
    .eq("user_id", user.sub)
    .order("created_at");

  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  return Response.json({ data: items ?? [], error: null });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await req.json();
  if (!id) {
    return Response.json({ data: null, error: "id is required" }, { status: 400 });
  }

  const { error } = await supaAdmin
    .from("plaid_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.sub); // ownership check

  if (error) {
    return Response.json({ data: null, error: error.message }, { status: 500 });
  }

  return Response.json({ data: { removed: true }, error: null });
}
