export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { data: rules } = await supaAdmin
    .from("categorization_rules")
    .select("pattern, category")
    .eq("user_id", user.sub);

  if (!rules?.length) return Response.json({ data: { updated: 0 }, error: null });

  const { data: accounts } = await supaAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", user.sub);

  const ids = (accounts ?? []).map((a: { id: string }) => a.id);
  if (!ids.length) return Response.json({ data: { updated: 0 }, error: null });

  const { data: txns } = await supaAdmin
    .from("transactions")
    .select("id, name, merchant_name")
    .in("account_id", ids);

  let updated = 0;

  for (const txn of txns ?? []) {
    const haystack = ((txn.merchant_name ?? txn.name) as string).toLowerCase();
    const match = (rules as { pattern: string; category: string }[])
      .find(r => haystack.includes(r.pattern));

    if (match) {
      await supaAdmin
        .from("transactions")
        .update({ category: [match.category] })
        .eq("id", txn.id);
      updated++;
    }
  }

  return Response.json({ data: { updated }, error: null });
}