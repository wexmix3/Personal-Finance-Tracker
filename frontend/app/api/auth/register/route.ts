export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { supaAdmin } from "@/lib/db";
import { signToken, signRefreshToken, makeRefreshCookieHeader } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return Response.json({ data: null, error: "Email and password required" }, { status: 400 });
    if (password.length < 8)
      return Response.json({ data: null, error: "Password must be at least 8 characters" }, { status: 400 });

    const hashed_password = await bcrypt.hash(password, 12);
    const { data: user, error } = await supaAdmin
      .from("users")
      .insert({ email: email.toLowerCase(), hashed_password })
      .select("id, email")
      .single();

    if (error || !user)
      return Response.json({ data: null, error: "Email already registered" }, { status: 409 });

    const payload = { sub: user.id, email: user.email };
    const [access_token, refresh_token] = await Promise.all([
      signToken(payload),
      signRefreshToken(payload),
    ]);
    return Response.json(
      { data: { access_token, token_type: "bearer", expires_in: 900 }, error: null },
      { status: 201, headers: { "Set-Cookie": makeRefreshCookieHeader(refresh_token) } }
    );
  } catch (err) {
    console.error("register error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}