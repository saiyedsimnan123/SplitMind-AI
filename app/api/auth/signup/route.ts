import { NextResponse } from "next/server";
import { maskEmailForAudit, maskPhoneForAudit } from "@/lib/audit";
import { validateE164Phone } from "@/lib/phone";
import {
  applySessionCookies,
  createConfirmedSupabaseUser,
  deriveSafeSessionId,
  parseDeviceSummary,
  signInWithSupabase,
  signUpWithSupabase,
  type SupabaseSessionTokens,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured, isSupabaseDbConfigured } from "@/lib/supabase/config";
import {
  adminRestFetch,
  ensureUserProfile,
  recordServerAuditEvent,
  seedInitialGoaWorkspaceIfNeeded,
} from "@/lib/supabase/db";

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

  let body: { fullName?: unknown; email?: unknown; password?: unknown; phone?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!fullName || fullName.length > 80) {
    return NextResponse.json({ error: "Enter your full name (under 80 characters)." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Choose a password with at least 8 characters." }, { status: 400 });
  }

  let validatedPhone: string | undefined;
  if (rawPhone) {
    const check = validateE164Phone(rawPhone);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    validatedPhone = check.e164;

    if (isSupabaseDbConfigured()) {
      try {
        const existingPhoneRows = await adminRestFetch<{ id: string }[]>(
          `profiles?phone=eq.${encodeURIComponent(validatedPhone)}&select=id&limit=1`,
        );
        if (existingPhoneRows?.length) {
          return NextResponse.json(
            {
              error:
                "This phone number is already linked to another SplitMind account. Leave phone blank or use a different number.",
            },
            { status: 409 },
          );
        }
      } catch {
        // Defer to database unique index if service query fails transiently.
      }
    }
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  try {
    let createdUserId: string | null = null;
    let session: SupabaseSessionTokens | null = null;

    if (isSupabaseDbConfigured()) {
      const adminResult = await createConfirmedSupabaseUser({
        email,
        password,
        fullName,
        contactPhone: validatedPhone,
      });

      if (adminResult.duplicateUser) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in or reset your password." },
          { status: 409 },
        );
      }

      createdUserId = adminResult.user?.id ?? null;
      session = await signInWithSupabase(email, password);
    } else {
      const result = await signUpWithSupabase({
        email,
        password,
        fullName,
        contactPhone: validatedPhone,
      });

      if (result.duplicateUser) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in or reset your password." },
          { status: 409 },
        );
      }

      createdUserId = result.user?.id ?? null;
      session = result.session;
      if (!session) {
        try {
          session = await signInWithSupabase(email, password);
        } catch (loginErr) {
          const reason = loginErr instanceof Error ? loginErr.message : "";
          const needsConfirmation = /confirm/i.test(reason) || !reason;
          return NextResponse.json(
            {
              error: needsConfirmation
                ? "Instant account creation requires turning OFF 'Confirm email' in Supabase Dashboard → Authentication → Providers → Email (or setting SUPABASE_SERVICE_ROLE_KEY on the server)."
                : reason,
            },
            { status: 503 },
          );
        }
      }
    }

    const activeSession = session;
    const userId = activeSession.user?.id ?? createdUserId ?? null;
    const sessionId = deriveSafeSessionId(activeSession.access_token);
    const createdAt = new Date().toISOString();

    let profile = null;
    try {
      const ensured = await ensureUserProfile(activeSession.access_token, activeSession.user);
      profile = ensured.profile;
      await seedInitialGoaWorkspaceIfNeeded(
        activeSession.access_token,
        ensured.profile,
        ensured.workspaceInitialized,
      );
    } catch {
      // Profile creation is also provisioned via DB trigger and seeded on dashboard load.
    }

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.signup",
      eventName: "Account created",
      status: "success",
      actorUserId: userId,
      actorLabel: fullName,
      description: validatedPhone
        ? `Registered SplitMind account (${maskEmailForAudit(email)}, ${maskPhoneForAudit(validatedPhone)}).`
        : `Registered SplitMind account (${maskEmailForAudit(email)}).`,
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
      ok: true,
      user: profile ?? { id: userId, email, fullName, ...(validatedPhone ? { phone: validatedPhone } : {}) },
    });
    applySessionCookies(
      response,
      {
        accessToken: activeSession.access_token,
        refreshToken: activeSession.refresh_token,
        sessionId,
        sessionCreatedAt: createdAt,
        expiresIn: activeSession.expires_in,
      },
      request,
    );
    return response;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not create your account.";
    const isDuplicate = /already registered|already exists|duplicate/i.test(msg);
    return NextResponse.json(
      { error: isDuplicate ? "An account with this email already exists. Please sign in or reset your password." : msg },
      { status: isDuplicate ? 409 : 400 },
    );
  }
}
