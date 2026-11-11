import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import {
  applySessionCookies,
  deriveSafeSessionId,
  parseDeviceSummary,
  verifySignupOtpWithSupabase,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile, recordServerAuditEvent } from "@/lib/supabase/db";
import {
  checkOtpVerifyAllowed,
  clearOtpVerifyFailures,
  getClientKey,
  recordOtpVerifyFailure,
} from "@/lib/supabase/rate-limit";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }

  let body: { email?: unknown; token?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; token?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";

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
    const tokens = await verifySignupOtpWithSupabase(email, token);
    clearOtpVerifyFailures(email, clientIp);

    const sessionId = deriveSafeSessionId(tokens.access_token);
    const createdAt = new Date().toISOString();

    let actorLabel = tokens.user.user_metadata?.full_name || maskEmailForAudit(email);
    let profile = null;
    try {
      const ensured = await ensureUserProfile(tokens.access_token, tokens.user);
      profile = ensured.profile;
      actorLabel = ensured.profile.fullName;
    } catch {
      // Profile creation is also provisioned via DB trigger.
    }

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.otp.verified",
      eventName: "Signup OTP verified",
      status: "success",
      actorUserId: tokens.user.id,
      actorLabel,
      description: `Verified 6-digit email OTP for ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { sessionId, device: deviceLabel },
    });

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.session.created",
      eventName: "Session created",
      status: "info",
      actorUserId: tokens.user.id,
      actorLabel,
      description: `Established HttpOnly session ${sessionId} after OTP verification (${deviceLabel}).`,
      metadata: { sessionId, device: deviceLabel },
    });

    const response = NextResponse.json({
      ok: true,
      user: profile ?? { id: tokens.user.id, email: tokens.user.email ?? email, fullName: actorLabel },
    });

    applySessionCookies(
      response,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sessionId,
        sessionCreatedAt: createdAt,
        expiresIn: tokens.expires_in,
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
