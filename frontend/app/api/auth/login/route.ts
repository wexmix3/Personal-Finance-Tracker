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

    const { data: user } = await supaAdmin
      .from("users")
      .select("id, email, hashed_password")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (!user)
      return Response.json({ data: null, error: "Incorrect email or password" }, { status: 401 });

    const valid = await bcrypt.compare(password, user.hashed_password);
    if (!valid)
      return Response.json({ data: null, error: "Incorrect email or password" }, { status: 401 });

    const payload = { sub: user.id, email: user.email };
    const [access_token, refresh_token] = await Promise.all([
      signToken(payload),
      signRefreshToken(payload),
    ]);
    return Response.json(
      { data: { access_token, token_type: "bearer", expires_in: 900 }, error: null },
      { headers: { "Set-Cookie": makeRefreshCookieHeader(refresh_token) } }
    );
  } catch (err) {
    console.error("login error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}