import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import {
  applySessionCookies,
  parseDeviceSummary,
  verifyEmailOtpWithSupabase,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";
import {
  checkOtpVerifyAllowed,
  clearOtpVerifyFailures,
  getClientKey,
  recordOtpVerifyFailure,
} from "@/lib/supabase/rate-limit";
import { establishVerifiedUserSession } from "@/lib/supabase/session-helper";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }

  let body: { email?: unknown; token?: unknown; mode?: unknown; rememberMe?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const mode = body.mode === "login" ? "login" : "signup";
  const rememberMe = body.rememberMe !== false;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: "Enter the complete 6-digit numeric verification code." }, { status: 400 });
  }

  const clientIp = getClientKey(request);
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  const rateCheck = checkOtpVerifyAllowed(email, clientIp);

  if (!rateCheck.allowed) {
    await recordServerAuditEvent({
      category: "security",
      eventType: "auth.otp.rate_limited",
      eventName: "OTP verification rate limited",
      status: "warning",
      actorUserId: null,
      actorLabel: maskEmailForAudit(email),
      description: `Blocked excessive OTP verification attempts for ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { retryAfterSeconds: rateCheck.retryAfterSeconds },
    });

    return NextResponse.json(
      {
        error: `Too many incorrect verification attempts. Please wait ${rateCheck.retryAfterSeconds}s or request a new OTP.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
  }

  try {
    const tokens = await verifyEmailOtpWithSupabase(
      email,
      token,
      mode === "login" ? "email" : "signup",
    );
    clearOtpVerifyFailures(email, clientIp);

    const established = await establishVerifiedUserSession({
      tokens,
      request,
      authMethod: "email_otp",
      eventType: "auth.otp.verified",
      eventName: mode === "login" ? "Login email OTP verified" : "Signup OTP verified",
      description: `Verified 6-digit ${mode} email OTP for ${maskEmailForAudit(email)}`,
      seedWorkspace: true,
    });

    const response = NextResponse.json({
      ok: true,
      user: established.profile,
    });

    applySessionCookies(
      response,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sessionId: established.sessionId,
        sessionCreatedAt: established.createdAt,
        expiresIn: tokens.expires_in,
        rememberMe,
      },
      request,
    );

    return response;
  } catch (error) {
    recordOtpVerifyFailure(email, clientIp);
    const raw = error instanceof Error ? error.message : "";
    const expired = /expired/i.test(raw);

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.otp.failed",
      eventName: expired ? "Expired signup OTP rejected" : "Invalid signup OTP rejected",
      status: "failure",
      actorUserId: null,
      actorLabel: maskEmailForAudit(email),
      description: `Rejected ${expired ? "expired" : "invalid"} 6-digit OTP for ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { expired, device: deviceLabel },
    });

    return NextResponse.json(
      {
        error: expired
          ? "This verification code has expired. Click Resend OTP to receive a new 6-digit code."
          : "Incorrect or invalid 6-digit verification code. Check your email and try again.",
      },
      { status: 400 },
    );
  }
}
