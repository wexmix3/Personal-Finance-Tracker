export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { supaAdmin } from "@/lib/db";
import { signVerifyToken } from "@/lib/auth-server";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

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

    const token = await signVerifyToken({ sub: user.id, email: user.email });
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

    await resend.emails.send({
      from: "Finance Tracker <noreply@finance-dashboard-max.vercel.app>",
      to: user.email,
      subject: "Verify your email address",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px">Verify your email</h2>
          <p style="color:#555;margin:0 0 24px">Click the button below to verify your email address and activate your account.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:500">Verify Email</a>
          <p style="color:#888;font-size:12px;margin:24px 0 0">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
        </div>
      `,
    });

    return Response.json(
      { data: { message: "Check your email to verify your account." }, error: null },
      { status: 201 }
    );
  } catch (err) {
    console.error("register error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
