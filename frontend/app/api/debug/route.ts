export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      const { data, error } = await supaAdmin.from("users").select("count").limit(1);
      return Response.json({ ok: !error, data, supabase_url: process.env.SUPABASE_URL });
    }

    const { data: accounts } = await supaAdmin
      .from("accounts").select("id, name, type").eq("user_id", user.sub);

    const ids = (accounts ?? []).map((a: { id: string }) => a.id);

    const { data: sample } = ids.length
      ? await supaAdmin
          .from("transactions")
          .select("id, amount, pending, date, category")
          .in("account_id", ids)
          .order("date", { ascending: false })
          .limit(10)
      : { data: [] };

    const { count: total } = ids.length
      ? await supaAdmin.from("transactions").select("*", { count: "exact", head: true }).in("account_id", ids)
      : { count: 0 };

    const { count: positiveCount } = ids.length
      ? await supaAdmin.from("transactions").select("*", { count: "exact", head: true }).in("account_id", ids).gt("amount", 0)
      : { count: 0 };

    const { count: pendingFalseCount } = ids.length
      ? await supaAdmin.from("transactions").select("*", { count: "exact", head: true }).in("account_id", ids).eq("pending", false)
      : { count: 0 };

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const { count: last30Count } = ids.length
      ? await supaAdmin.from("transactions").select("*", { count: "exact", head: true }).in("account_id", ids).gte("date", cutoff.toISOString().split("T")[0])
      : { count: 0 };

    return Response.json({
      data: {
        accounts,
        total_transactions: total,
        positive_amount: positiveCount,
        pending_false: pendingFalseCount,
        within_last_30d: last30Count,
        sample_transactions: sample,
      },
      error: null,
    });
  } catch (err: unknown) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}