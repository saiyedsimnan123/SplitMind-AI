import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import {
  applySessionCookies,
  deriveSafeSessionId,
  parseDeviceSummary,
  signUpWithSupabase,
} from "@/lib/supabase/auth";
import { getCanonicalOrigin, isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile, recordServerAuditEvent } from "@/lib/supabase/db";

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
  const origin = getCanonicalOrigin(request.url);

  try {
    const result = await signUpWithSupabase({
      email,
      password,
      fullName,
      redirectTo: `${origin}/api/auth/confirm?next=/`,
    });

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

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.signup",
      eventName: "Account registration pending confirmation",
      status: "info",
      actorUserId: userId,
      actorLabel: fullName,
      description: `Registered ${maskEmailForAudit(email)}; email verification link sent.`,
      metadata: { device: deviceLabel },
    });

    return NextResponse.json({
      requiresEmailConfirmation: true,
      message: "Check your email to confirm your account before signing in.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create your account." },
      { status: 400 },
    );
  }
}
