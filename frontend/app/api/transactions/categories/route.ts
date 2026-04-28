export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.sub);

  const ids = (accounts ?? []).map((a: { id: string }) => a.id);
  if (!ids.length) return Response.json({ data: [], error: null });

  const { data: txns } = await supaAdmin
    .from("transactions")
    .select("category")
    .in("account_id", ids)
    .not("category", "is", null);

  const cats = new Set<string>();
  for (const t of txns ?? []) {
    const arr = Array.isArray(t.category) ? t.category : [t.category];
    for (const c of arr) {
      if (c) cats.add(c);
    }
  }

  return Response.json({ data: Array.from(cats).sort(), error: null });
}