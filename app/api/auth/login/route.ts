import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import {
  applySessionCookies,
  deriveSafeSessionId,
  parseDeviceSummary,
  signInWithSupabase,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile, recordServerAuditEvent } from "@/lib/supabase/db";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local to sign in.",
      },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown; rememberMe?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown; rememberMe?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const rememberMe = body.rememberMe !== false;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password || password.length < 6 || password.length > 200) {
    return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  try {
    const tokens = await signInWithSupabase(email, password);
    const sessionId = deriveSafeSessionId(tokens.access_token);
    const createdAt = new Date().toISOString();

    let actorLabel = maskEmailForAudit(email);
    let profile = null;
    try {
      const ensured = await ensureUserProfile(tokens.access_token, tokens.user);
      profile = ensured.profile;
      actorLabel = ensured.profile.fullName;
    } catch {
      actorLabel = tokens.user.user_metadata?.full_name || maskEmailForAudit(email);
    }

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.login.succeeded",
      eventName: "Login succeeded",
      status: "success",
      actorUserId: tokens.user.id,
      actorLabel,
      description: `Signed in via Supabase Auth (${deviceLabel}).`,
      metadata: { sessionId, device: deviceLabel },
    });

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.session.created",
      eventName: "Session created",
      status: "info",
      actorUserId: tokens.user.id,
      actorLabel,
      description: `Established HttpOnly server session ${sessionId} (${deviceLabel}).`,
      metadata: { sessionId, device: deviceLabel },
    });

    const response = NextResponse.json({
      user: profile ?? {
        id: tokens.user.id,
        email: tokens.user.email,
        fullName: actorLabel,
      },
      session: {
        sessionId,
        deviceLabel,
        createdAt,
      },
    });

    applySessionCookies(
      response,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sessionId,
        sessionCreatedAt: createdAt,
        expiresIn: tokens.expires_in,
        rememberMe,
      },
      request,
    );

    return response;
  } catch (error) {
    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.login.failed",
      eventName: "Login attempt failed",
      status: "failure",
      actorUserId: null,
      actorLabel: maskEmailForAudit(email),
      description: `Rejected sign-in attempt for ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { device: deviceLabel },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid email or password." },
      { status: 401 },
    );
  }
}
