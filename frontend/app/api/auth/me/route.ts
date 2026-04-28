export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data } = await supaAdmin
    .from("users")
    .select("id, email, created_at")
    .eq("id", user.sub)
    .maybeSingle();

  if (!data) return unauthorized();
  return Response.json({ data, error: null });
}