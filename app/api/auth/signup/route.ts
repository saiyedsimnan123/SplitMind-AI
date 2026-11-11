import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import {
  applySessionCookies,
  deriveSafeSessionId,
  parseDeviceSummary,
  signUpWithSupabase,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile, recordServerAuditEvent } from "@/lib/supabase/db";
import { getClientKey, recordOtpResendAttempt } from "@/lib/supabase/rate-limit";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local to create an account.",
      },
      { status: 503 },
    );
  }

  let body: { fullName?: unknown; email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { fullName?: unknown; email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!fullName || fullName.length > 80) {
    return NextResponse.json({ error: "Enter your full name (under 80 characters)." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Choose a password with at least 8 characters." }, { status: 400 });
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  const clientIp = getClientKey(request);

  try {
    const result = await signUpWithSupabase({
      email,
      password,
      fullName,
    });

    if (result.duplicateUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in or reset your password." },
        { status: 409 },
      );
    }

    const userId = result.user?.id ?? null;

    if (result.session) {
      const sessionId = deriveSafeSessionId(result.session.access_token);
      const createdAt = new Date().toISOString();

      let profile = null;
      try {
        const ensured = await ensureUserProfile(result.session.access_token, result.session.user);
        profile = ensured.profile;
      } catch {
        // Profile creation is also provisioned via DB trigger.
      }

      await recordServerAuditEvent({
        category: "authentication",
        eventType: "auth.signup",
        eventName: "Account created",
        status: "success",
        actorUserId: userId,
        actorLabel: fullName,
        description: `Registered SplitMind account (${maskEmailForAudit(email)}).`,
        metadata: { sessionId, device: deviceLabel },
      });

      await recordServerAuditEvent({
        category: "authentication",
        eventType: "auth.session.created",
        eventName: "Session created",
        status: "info",
        actorUserId: userId,
        actorLabel: fullName,
        description: `Established HttpOnly session ${sessionId} on sign-up (${deviceLabel}).`,
        metadata: { sessionId, device: deviceLabel },
      });

      const response = NextResponse.json({
        requiresOtpVerification: false,
        requiresEmailConfirmation: false,
        user: profile ?? { id: userId, email, fullName },
      });
      applySessionCookies(
        response,
        {
          accessToken: result.session.access_token,
          refreshToken: result.session.refresh_token,
          sessionId,
          sessionCreatedAt: createdAt,
          expiresIn: result.session.expires_in,
        },
        request,
      );
      return response;
    }

    recordOtpResendAttempt(email, clientIp);

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.otp.sent",
      eventName: "Signup OTP sent",
      status: "info",
      actorUserId: userId,
      actorLabel: fullName,
      description: `Sent 6-digit signup verification OTP to ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { device: deviceLabel },
    });

    return NextResponse.json({
      requiresOtpVerification: true,
      requiresEmailConfirmation: true,
      email,
      cooldownSeconds: 60,
      message: "Enter the 6-digit verification code sent to your email address.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not create your account.";
    const isDuplicate = /already registered|already exists/i.test(msg);
    return NextResponse.json(
      { error: isDuplicate ? "An account with this email already exists. Please sign in or reset your password." : msg },
      { status: isDuplicate ? 409 : 400 },
    );
  }
}
