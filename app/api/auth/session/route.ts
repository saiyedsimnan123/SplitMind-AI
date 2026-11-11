import { NextResponse } from "next/server";
import {
  applySessionCookies,
  clearSessionCookies,
  getRequestSession,
  isDemoAuthUser,
  parseDeviceSummary,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { authUserToFallbackProfile, ensureUserProfile } from "@/lib/supabase/db";

export async function GET(request: Request) {
  const authConfigured = isSupabaseAuthConfigured();
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  if (!authConfigured) {
    return NextResponse.json({
      authConfigured: false,
      authenticated: false,
      user: null,
      session: {
        authenticated: false,
        authConfigured: false,
        sessionId: null,
        provider: "Local preview mode (Supabase Auth unconfigured)",
        createdAt: null,
        deviceLabel,
        storageMode: "local_preview",
      },
    });
  }

  const session = await getRequestSession(request);
  if (!session) {
    const res = NextResponse.json({
      authConfigured: true,
      authenticated: false,
      user: null,
      session: {
        authenticated: false,
        authConfigured: true,
        sessionId: null,
        provider: "Supabase Auth",
        createdAt: null,
        deviceLabel,
        storageMode: "supabase_http_only",
      },
    });
    clearSessionCookies(res, request);
    return res;
  }

  let profile = authUserToFallbackProfile(session.user);
  try {
    const ensured = await ensureUserProfile(session.accessToken, session.user);
    profile = ensured.profile;
  } catch {
    // Use auth metadata fallback if profile table isn't migrated yet.
  }

  const isDemo = isDemoAuthUser(session.user);
  const providerLabel = isDemo
    ? "Supabase Anonymous Auth · Isolated Demo"
    : "Email & Password (Supabase Auth · HttpOnly)";

  const res = NextResponse.json({
    authConfigured: true,
    authenticated: true,
    isDemo,
    user: profile,
    session: {
      authenticated: true,
      authConfigured: true,
      isDemo,
      sessionId: session.sessionId,
      provider: providerLabel,
      createdAt: session.sessionCreatedAt,
      deviceLabel,
      storageMode: "supabase_http_only",
    },
  });

  if (session.refreshed) {
    applySessionCookies(res, session, request);
  }
  return res;
}
