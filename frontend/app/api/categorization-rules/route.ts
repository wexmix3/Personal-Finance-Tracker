export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data, error } = await supaAdmin
    .from("categorization_rules")
    .select("id, pattern, category, created_at")
    .eq("user_id", user.sub)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
  return Response.json({ data: data ?? [], error: null });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { pattern, category } = await req.json();
  if (!pattern?.trim() || !category?.trim())
    return Response.json({ data: null, error: "pattern and category are required" }, { status: 400 });

  const { data, error } = await supaAdmin
    .from("categorization_rules")
    .upsert(
      { user_id: user.sub, pattern: pattern.trim().toLowerCase(), category: category.trim() },
      { onConflict: "user_id,pattern" }
    )
    .select("id, pattern, category")
    .single();

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });
  return Response.json({ data, error: null }, { status: 201 });
}