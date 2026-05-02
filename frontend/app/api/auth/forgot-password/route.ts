export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Resend } from "resend";
import { supaAdmin } from "@/lib/db";
import { signResetToken } from "@/lib/auth-server";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return Response.json({ data: null, error: "Email required" }, { status: 400 });
    }

    const { data: user } = await supaAdmin
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    // Always return 200 — don't reveal whether the email exists
    if (!user) {
      return Response.json({ data: { sent: true }, error: null });
    }

    const token = await signResetToken({ sub: user.id, email: user.email });
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: "Finance Tracker <noreply@getchapterly.com>",
      to: user.email,
      subject: "Reset your password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Reset your password</h2>
          <p style="color:#64748b;margin-bottom:24px">
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;
                    padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return Response.json({ data: { sent: true }, error: null });
  } catch (err) {
    console.error("forgot-password error", err);
    return Response.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
