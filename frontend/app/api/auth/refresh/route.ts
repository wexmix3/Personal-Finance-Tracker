export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import {
  signToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshToken,
  makeRefreshCookieHeader,
  clearRefreshCookieHeader,
} from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  const raw = getRefreshToken(req);
  if (!raw) {
    return Response.json({ data: null, error: "No refresh token" }, { status: 401 });
  }

  try {
    const payload = await verifyRefreshToken(raw);
    const newPayload = { sub: payload.sub, email: payload.email };
    const [access_token, refresh_token] = await Promise.all([
      signToken(newPayload),
      signRefreshToken(newPayload),
    ]);
    return Response.json(
      { data: { access_token, token_type: "bearer", expires_in: 900 }, error: null },
      { headers: { "Set-Cookie": makeRefreshCookieHeader(refresh_token) } }
    );
  } catch {
    return Response.json(
      { data: null, error: "Invalid or expired refresh token" },
      { status: 401, headers: { "Set-Cookie": clearRefreshCookieHeader() } }
    );
  }
}