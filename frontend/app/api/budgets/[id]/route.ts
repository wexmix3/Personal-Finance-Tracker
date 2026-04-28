export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

async function ownsBudget(userId: string, budgetId: string): Promise<boolean> {
  const { data } = await supaAdmin
    .from("budgets")
    .select("id")
    .eq("id", budgetId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!(await ownsBudget(user.sub, params.id))) {
    return Response.json({ data: null, error: "Budget not found" }, { status: 404 });
  }

  const { monthly_limit } = await req.json();
  const limit = parseFloat(monthly_limit);
  if (isNaN(limit) || limit <= 0) {
    return Response.json({ data: null, error: "monthly_limit must be a positive number" }, { status: 400 });
  }

  await supaAdmin.from("budgets").update({ monthly_limit: limit }).eq("id", params.id);
  return Response.json({ data: { updated: true }, error: null });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  if (!(await ownsBudget(user.sub, params.id))) {
    return Response.json({ data: null, error: "Budget not found" }, { status: 404 });
  }

  await supaAdmin.from("budgets").delete().eq("id", params.id);
  return Response.json({ data: { deleted: true }, error: null });
}