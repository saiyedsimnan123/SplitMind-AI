import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import {
  parseDeviceSummary,
  resendSignupOtpWithSupabase,
  sendEmailOtpWithSupabase,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";
import {
  checkOtpResendAllowed,
  getClientKey,
  recordOtpResendAttempt,
} from "@/lib/supabase/rate-limit";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }

  let body: { email?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; mode?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const mode = body.mode === "login" ? "login" : "signup";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const clientIp = getClientKey(request);
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  const allowed = checkOtpResendAllowed(email, clientIp);

  if (!allowed.allowed) {
    return NextResponse.json(
      {
        error: `${allowed.reason} Try again in ${allowed.retryAfterSeconds}s.`,
        retryAfterSeconds: allowed.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(allowed.retryAfterSeconds) },
      },
    );
  }

  try {
    if (mode === "login") {
      await sendEmailOtpWithSupabase(email, { createUser: false });
    } else {
      await resendSignupOtpWithSupabase(email);
    }
    recordOtpResendAttempt(email, clientIp);

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.otp.resent",
      eventName: mode === "login" ? "Login email OTP resent" : "Signup OTP resent",
      status: "info",
      actorUserId: null,
      actorLabel: maskEmailForAudit(email),
      description: `Resent 6-digit ${mode} email verification code to ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { device: deviceLabel, mode },
    });

    return NextResponse.json({
      ok: true,
      cooldownSeconds: 60,
      message: "A fresh 6-digit verification code has been sent to your email.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resend verification code." },
      { status: 400 },
    );
  }
}
