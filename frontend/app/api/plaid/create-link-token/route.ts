export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth-server";
import { plaidClient } from "@/lib/plaid-client";
import { CountryCode, Products } from "plaid";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.sub },
      client_name: "Finance Dashboard",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return Response.json({
      data: { link_token: response.data.link_token },
      error: null,
    });
  } catch (err) {
    console.error("plaid create-link-token error", err);
    return Response.json(
      { data: null, error: "Failed to create Plaid link token" },
      { status: 502 }
    );
  }
}
