export const dynamic = "force-dynamic";

import { clearRefreshCookieHeader } from "@/lib/auth-server";

export async function POST() {
  return Response.json(
    { data: { logged_out: true }, error: null },
    { headers: { "Set-Cookie": clearRefreshCookieHeader() } }
  );
}