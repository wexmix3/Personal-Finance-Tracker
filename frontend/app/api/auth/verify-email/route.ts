export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { supaAdmin } from "@/lib/db";
import { verifyVerifyToken } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token)
      return Response.json({ data: null, error: "Token required" }, { status: 400 });

    let payload: { sub: string; email: string };
    try {
      payload = await verifyVerifyToken(token);
    } catch {
      return Response.json({ data: null, error: "Invalid or expired link. Please register again or request a new verification email." }, { status: 400 });
    }

    const { error } = await supaAdmin
      .from("users")
      .update({ email_verified: true })
      .eq("id", payload.sub)
      .eq("email_verified", false);

    if (error) {
      return Response.json({ data: null, error: "Could not verify email. It may already be verified." }, { status: 400 });
    }

    return Response.json({ data: { message: "Email verified." }, error: null });
  } catch (err) {
    console.error("verify-email error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
