import { NextResponse } from "next/server";
import { maskPhoneForAudit } from "@/lib/audit";
import {
  DEFAULT_COUNTRY_DIAL_CODE,
  validateAndFormatPhone,
  validateE164Phone,
} from "@/lib/phone";
import {
  applySessionCookies,
  parseDeviceSummary,
  verifyPhoneOtpWithSupabase,
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

  let body: {
    countryCode?: unknown;
    localNumber?: unknown;
    phone?: unknown;
    token?: unknown;
    rememberMe?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation =
    typeof body.localNumber === "string"
      ? validateAndFormatPhone(
          typeof body.countryCode === "string" ? body.countryCode : DEFAULT_COUNTRY_DIAL_CODE,
          body.localNumber,
        )
      : validateE164Phone(typeof body.phone === "string" ? body.phone : "");

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json(
      { error: "Enter the complete 6-digit SMS verification code." },
      { status: 400 },
    );
  }

  const e164 = validation.e164;
  const rateSubject = `phone:${e164}`;
  const rememberMe = body.rememberMe !== false;
  const clientIp = getClientKey(request);
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  const rateCheck = checkOtpVerifyAllowed(rateSubject, clientIp);

  if (!rateCheck.allowed) {
    await recordServerAuditEvent({
      category: "security",
      eventType: "auth.otp.rate_limited",
      eventName: "Phone OTP verification rate limited",
      status: "warning",
      actorUserId: null,
      actorLabel: maskPhoneForAudit(e164),
      description: `Blocked excessive phone OTP verification attempts for ${maskPhoneForAudit(e164)} (${deviceLabel}).`,
      metadata: { retryAfterSeconds: rateCheck.retryAfterSeconds, channel: "sms" },
    });

    return NextResponse.json(
      {
        error: `Too many incorrect SMS codes. Wait ${rateCheck.retryAfterSeconds}s or request a new OTP.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
  }

  try {
    const tokens = await verifyPhoneOtpWithSupabase(e164, token);
    clearOtpVerifyFailures(rateSubject, clientIp);

    const established = await establishVerifiedUserSession({
      tokens,
      request,
      authMethod: "phone_otp",
      eventType: "auth.phone_otp.verified",
      eventName: "Phone OTP verified",
      description: `Verified 6-digit SMS OTP for ${maskPhoneForAudit(e164)}`,
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
    recordOtpVerifyFailure(rateSubject, clientIp);
    const raw = error instanceof Error ? error.message : "";
    const expired = /expired/i.test(raw);

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.phone_otp.failed",
      eventName: expired ? "Expired phone OTP rejected" : "Invalid phone OTP rejected",
      status: "failure",
      actorUserId: null,
      actorLabel: maskPhoneForAudit(e164),
      description: `Rejected ${expired ? "expired" : "invalid"} 6-digit SMS OTP for ${maskPhoneForAudit(e164)} (${deviceLabel}).`,
      metadata: { expired, device: deviceLabel, channel: "sms" },
    });

    return NextResponse.json(
      {
        error: expired
          ? "This SMS verification code has expired. Click Resend OTP for a new 6-digit code."
          : "Incorrect or invalid 6-digit SMS code. Check your messages and try again.",
      },
      { status: 400 },
    );
  }
}
