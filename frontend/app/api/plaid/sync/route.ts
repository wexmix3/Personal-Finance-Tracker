export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { supaAdmin } from "@/lib/db";
import { syncPlaidItem } from "@/lib/plaid-sync";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const itemId: string | undefined = body.item_id;

  let query = supaAdmin
    .from("plaid_items")
    .select("id, encrypted_access_token, institution_name")
    .eq("user_id", user.sub);

  if (itemId) query = query.eq("id", itemId);

  const { data: items, error } = await query;

  if (error || !items?.length) {
    return Response.json(
      { data: null, error: "No linked institutions found. Connect a bank first." },
      { status: 404 }
    );
  }

  const results = [];
  const errors: string[] = [];

  for (const item of items) {
    try {
      const result = await syncPlaidItem(
        item.encrypted_access_token as string,
        item.id as string,
        user.sub,
        item.institution_name as string | null
      );
      results.push({ institution: item.institution_name, ...result });
    } catch (err) {
      errors.push(`${item.institution_name ?? item.id}: ${String(err)}`);
    }
  }

  return Response.json({
    data: { items_synced: results.length, results, errors },
    error: errors.length > 0 && results.length === 0 ? errors.join("; ") : null,
  });
}
