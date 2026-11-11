import { NextResponse } from "next/server";
import { maskPhoneForAudit } from "@/lib/audit";
import {
  DEFAULT_COUNTRY_DIAL_CODE,
  validateAndFormatPhone,
  validateE164Phone,
} from "@/lib/phone";
import { parseDeviceSummary, sendPhoneOtpWithSupabase } from "@/lib/supabase/auth";
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

  let body: {
    countryCode?: unknown;
    localNumber?: unknown;
    phone?: unknown;
    fullName?: unknown;
    mode?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const mode = body.mode === "login" ? "login" : "signup";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

  if (mode === "signup" && fullName && fullName.length > 80) {
    return NextResponse.json({ error: "Full name must be under 80 characters." }, { status: 400 });
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

  const e164 = validation.e164;
  const rateSubject = `phone:${e164}`;
  const clientIp = getClientKey(request);
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  const allowed = checkOtpResendAllowed(rateSubject, clientIp);

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
    await sendPhoneOtpWithSupabase({
      phone: e164,
      fullName: fullName || undefined,
      createUser: mode === "signup",
    });

    recordOtpResendAttempt(rateSubject, clientIp);

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.phone_otp.sent",
      eventName: "SMS verification OTP sent",
      status: "info",
      actorUserId: null,
      actorLabel: maskPhoneForAudit(e164),
      description: `Requested 6-digit SMS OTP for ${maskPhoneForAudit(e164)} (${deviceLabel}).`,
      metadata: { device: deviceLabel, channel: "sms", mode, countryCode: validation.countryCode },
    });

    return NextResponse.json({
      ok: true,
      phone: e164,
      maskedPhone: maskPhoneForAudit(e164),
      cooldownSeconds: 60,
      message: `Enter the 6-digit SMS code sent to ${e164}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send SMS OTP.";
    const status = /disabled/i.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
