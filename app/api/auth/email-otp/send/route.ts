import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import { parseDeviceSummary, sendEmailOtpWithSupabase } from "@/lib/supabase/auth";
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

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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
    await sendEmailOtpWithSupabase(email, { createUser: false });
    recordOtpResendAttempt(email, clientIp);

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.otp.sent",
      eventName: "Login email OTP sent",
      status: "info",
      actorUserId: null,
      actorLabel: maskEmailForAudit(email),
      description: `Sent 6-digit login verification code to ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { device: deviceLabel, channel: "email", mode: "login" },
    });

    return NextResponse.json({
      ok: true,
      email,
      cooldownSeconds: 60,
      message: "Enter the 6-digit login code sent to your email address.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send email verification code." },
      { status: 400 },
    );
  }
}
