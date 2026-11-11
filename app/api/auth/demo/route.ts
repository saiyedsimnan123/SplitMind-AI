import { NextResponse } from "next/server";
import {
  applySessionCookies,
  deriveSafeSessionId,
  parseDeviceSummary,
  signInAnonymouslyForDemo,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
  ensureUserProfile,
  recordServerAuditEvent,
  seedInitialGoaWorkspaceIfNeeded,
} from "@/lib/supabase/db";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to launch an isolated demo session.",
      },
      { status: 503 },
    );
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  try {
    const tokens = await signInAnonymouslyForDemo();
    const sessionId = deriveSafeSessionId(tokens.access_token);
    const createdAt = new Date().toISOString();

    try {
      const ensured = await ensureUserProfile(tokens.access_token, tokens.user);
      await seedInitialGoaWorkspaceIfNeeded(
        tokens.access_token,
        ensured.profile,
        ensured.workspaceInitialized,
      );
    } catch {
      // Dashboard server loader also ensures profile & Goa Trip 2026 sample seed.
    }

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.demo.started",
      eventName: "Isolated demo session started",
      status: "info",
      actorUserId: tokens.user.id,
      actorLabel: "Demo Explorer (DEMO)",
      description: `Launched isolated Supabase anonymous demo session ${sessionId} (${deviceLabel}).`,
      metadata: { sessionId, device: deviceLabel, isDemo: true },
    });

    const response = NextResponse.json({
      ok: true,
      isDemo: true,
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
        rememberMe: false,
      },
      request,
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start an isolated demo session. Enable Anonymous Sign-Ins in Supabase Auth.",
      },
      { status: 503 },
    );
  }
}
