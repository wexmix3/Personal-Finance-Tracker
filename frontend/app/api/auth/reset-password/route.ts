export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/db";
import { verifyResetToken } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return Response.json({ data: null, error: "Token and password required" }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ data: null, error: "Password must be at least 8 characters" }, { status: 400 });
    }

    let payload;
    try {
      payload = await verifyResetToken(token);
    } catch {
      return Response.json({ data: null, error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    const hashed_password = await bcrypt.hash(password, 12);
    const { error } = await supaAdmin
      .from("users")
      .update({ hashed_password })
      .eq("id", payload.sub);

    if (error) {
      return Response.json({ data: null, error: "Failed to update password" }, { status: 500 });
    }

    return Response.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error("reset-password error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
