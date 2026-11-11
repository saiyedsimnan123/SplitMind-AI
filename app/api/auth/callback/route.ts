import { NextResponse } from "next/server";
import {
  applySessionCookies,
  clearOAuthPkceCookie,
  exchangePkceCodeWithSupabase,
  parseDeviceSummary,
  readOAuthPkceCookie,
} from "@/lib/supabase/auth";
import { getCanonicalOrigin, isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";
import { establishVerifiedUserSession } from "@/lib/supabase/session-helper";

function redirectWithOAuthError(
  origin: string,
  message: string,
  request: Request,
): NextResponse {
  const response = NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(message)}`,
    { status: 303 },
  );
  clearOAuthPkceCookie(response, request);
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getCanonicalOrigin(request.url);
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  if (!isSupabaseAuthConfigured()) {
    return redirectWithOAuthError(origin, "Supabase Auth is not configured for Google OAuth.", request);
  }

  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  if (oauthError) {
    const cancelled = oauthError === "access_denied";
    const friendly = cancelled
      ? "Google sign-in was cancelled. You can try again or choose Email or Phone OTP."
      : oauthErrorDescription || "Google authentication failed. Please try again.";

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.oauth.failed",
      eventName: cancelled ? "Google OAuth cancelled" : "Google OAuth failed",
      status: "failure",
      actorUserId: null,
      actorLabel: "Google OAuth",
      description: `Google OAuth callback returned error "${oauthError}" (${deviceLabel}).`,
      metadata: { provider: "google", oauthError, device: deviceLabel },
    });

    return redirectWithOAuthError(origin, friendly, request);
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const pkce = readOAuthPkceCookie(request);

  if (!code || !pkce) {
    await recordServerAuditEvent({
      category: "security",
      eventType: "auth.oauth.failed",
      eventName: "Invalid Google OAuth callback",
      status: "warning",
      actorUserId: null,
      actorLabel: "Google OAuth",
      description: `Rejected Google OAuth callback missing code or PKCE verifier cookie (${deviceLabel}).`,
      metadata: { provider: "google", hasCode: Boolean(code), hasVerifier: Boolean(pkce) },
    });

    return redirectWithOAuthError(
      origin,
      "Your Google sign-in session expired or could not be verified. Please click Continue with Google again.",
      request,
    );
  }

  try {
    const tokens = await exchangePkceCodeWithSupabase(code, pkce.verifier);
    const established = await establishVerifiedUserSession({
      tokens,
      request,
      authMethod: "google_oauth",
      eventType: "auth.oauth.succeeded",
      eventName: "Google OAuth login succeeded",
      description: "Authenticated via Google OAuth (Supabase PKCE)",
      seedWorkspace: true,
    });

    const response = NextResponse.redirect(`${origin}${pkce.next}`, { status: 303 });
    clearOAuthPkceCookie(response, request);
    applySessionCookies(
      response,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        sessionId: established.sessionId,
        sessionCreatedAt: established.createdAt,
        expiresIn: tokens.expires_in,
        rememberMe: true,
      },
      request,
    );
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not complete Google OAuth sign-in.";

    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.oauth.failed",
      eventName: "Google OAuth code exchange failed",
      status: "failure",
      actorUserId: null,
      actorLabel: "Google OAuth",
      description: `Supabase PKCE exchange failed for Google OAuth (${deviceLabel}): ${message}`,
      metadata: { provider: "google", device: deviceLabel },
    });

    return redirectWithOAuthError(origin, message, request);
  }
}
