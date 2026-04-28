export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  await supaAdmin
    .from("categorization_rules")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.sub);

  return Response.json({ data: { deleted: true }, error: null });
}