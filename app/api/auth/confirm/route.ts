import { NextResponse } from "next/server";
import {
  applySessionCookies,
  deriveSafeSessionId,
  parseDeviceSummary,
  safeRedirectPath,
  verifySupabaseTokenHash,
} from "@/lib/supabase/auth";
import { getCanonicalOrigin, isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile, recordServerAuditEvent } from "@/lib/supabase/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getCanonicalOrigin(request.url);
  const nextPath = safeRedirectPath(url.searchParams.get("next"), "/");
  const tokenHash = url.searchParams.get("token_hash") ?? "";
  const type = url.searchParams.get("type") ?? "email";

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Supabase Auth is not configured.")}`,
      { status: 303 },
    );
  }

  if (!tokenHash) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing verification token.")}`,
      { status: 303 },
    );
  }

  try {
    const tokens = await verifySupabaseTokenHash(tokenHash, type);
    const sessionId = deriveSafeSessionId(tokens.access_token);
    const createdAt = new Date().toISOString();
    const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

    let actorLabel = tokens.user.user_metadata?.full_name || tokens.user.email;
    try {
      const ensured = await ensureUserProfile(tokens.access_token, tokens.user);
      actorLabel = ensured.profile.fullName;
    } catch {
      // Ignore secondary profile bootstrap failure here.
    }

    await recordServerAuditEvent({
      category: "authentication",
      eventType: type === "recovery" ? "auth.password_reset.verified" : "auth.session.created",
      eventName: type === "recovery" ? "Password recovery link verified" : "Email verification completed",
      status: "success",
      actorUserId: tokens.user.id,
      actorLabel,
      description: `Verified ${type} token and established session ${sessionId} (${deviceLabel}).`,
      metadata: { sessionId, type, device: deviceLabel },
    });

    const response = NextResponse.redirect(`${origin}${nextPath}`, { status: 303 });
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
    const fallbackRoute = nextPath.startsWith("/reset-password") ? "/reset-password" : "/login";
    const msg = error instanceof Error ? error.message : "Verification link expired or invalid.";
    return NextResponse.redirect(`${origin}${fallbackRoute}?error=${encodeURIComponent(msg)}`, {
      status: 303,
    });
  }
}
