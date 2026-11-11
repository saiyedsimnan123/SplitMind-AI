import { NextResponse } from "next/server";
import {
  applySessionCookies,
  deriveSafeSessionId,
  getRequestSession,
  parseDeviceSummary,
  updateSupabaseUser,
  verifySupabaseTokenHash,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY." },
      { status: 503 },
    );
  }

  let body: { password?: unknown; tokenHash?: unknown; type?: unknown };
  try {
    body = (await request.json()) as { password?: unknown; tokenHash?: unknown; type?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Choose a new password with at least 8 characters." }, { status: 400 });
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  let session = await getRequestSession(request);
  let verifiedTokens: { accessToken: string; refreshToken: string; expiresIn?: number } | null = null;

  if (!session && typeof body.tokenHash === "string" && body.tokenHash.trim()) {
    try {
      const tokens = await verifySupabaseTokenHash(
        body.tokenHash.trim(),
        typeof body.type === "string" ? body.type : "recovery",
      );
      verifiedTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      };
      session = {
        user: tokens.user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sessionId: deriveSafeSessionId(tokens.access_token),
        sessionCreatedAt: new Date().toISOString(),
        refreshed: true,
      };
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid or expired recovery token." },
        { status: 401 },
      );
    }
  }

  if (!session) {
    return NextResponse.json(
      { error: "Your password reset session is missing or expired. Request a fresh reset link." },
      { status: 401 },
    );
  }

  try {
    const updatedUser = await updateSupabaseUser(session.accessToken, { password });
    const actorLabel = updatedUser.user_metadata?.full_name || updatedUser.email;

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.password_reset.completed",
      eventName: "Password reset completed",
      status: "success",
      actorUserId: updatedUser.id,
      actorLabel,
      description: `Updated account password via verified recovery session (${deviceLabel}).`,
      metadata: { sessionId: session.sessionId, device: deviceLabel },
    });

    const response = NextResponse.json({ ok: true, message: "Your password has been updated." });
    if (verifiedTokens) {
      applySessionCookies(
        response,
        {
          accessToken: verifiedTokens.accessToken,
          refreshToken: verifiedTokens.refreshToken,
          sessionId: session.sessionId,
          sessionCreatedAt: session.sessionCreatedAt,
          expiresIn: verifiedTokens.expiresIn,
        },
        request,
      );
    } else if (session.refreshed) {
      applySessionCookies(response, session, request);
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reset password." },
      { status: 400 },
    );
  }
}
