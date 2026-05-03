export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { plaidClient } from "@/lib/plaid-client";
import { supaAdmin } from "@/lib/db";
import { syncPlaidItem } from "@/lib/plaid-sync";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const { public_token, institution_name } = await req.json();
    if (!public_token) {
      return Response.json(
        { data: null, error: "public_token is required" },
        { status: 400 }
      );
    }

    // 1. Exchange the short-lived public_token for a durable access_token
    const exchangeResp = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    const { access_token, item_id } = exchangeResp.data;

    // 2. Upsert into plaid_items (handles reconnects)
    const { data: item, error: itemError } = await supaAdmin
      .from("plaid_items")
      .upsert(
        {
          user_id: user.sub,
          encrypted_access_token: access_token,
          item_id,
          institution_name: institution_name ?? null,
        },
        { onConflict: "item_id" }
      )
      .select("id")
      .single();

    if (itemError || !item) {
      console.error("plaid_items upsert error", itemError);
      return Response.json(
        { data: null, error: "Failed to save linked institution" },
        { status: 500 }
      );
    }

    // 3. Sync accounts + transactions (last 90 days)
    const result = await syncPlaidItem(
      access_token,
      item.id as string,
      user.sub,
      institution_name ?? null
    );

    return Response.json({
      data: {
        item_id,
        institution_name: institution_name ?? null,
        accounts_synced: result.accounts,
        transactions_synced: result.transactions,
      },
      error: null,
    });
  } catch (err) {
    console.error("plaid exchange-token error", err);
    return Response.json(
      { data: null, error: "Failed to link institution" },
      { status: 502 }
    );
  }
}
