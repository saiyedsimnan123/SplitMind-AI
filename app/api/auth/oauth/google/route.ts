import { NextResponse } from "next/server";
import {
  applyOAuthPkceCookie,
  buildGoogleOAuthUrl,
  createPkcePair,
  safeRedirectPath,
} from "@/lib/supabase/auth";
import { getCanonicalOrigin, isSupabaseAuthConfigured } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const origin = getCanonicalOrigin(request.url);
  const nextPath = safeRedirectPath(reqUrl.searchParams.get("next"), "/");

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Supabase Auth is not configured for Google OAuth.")}`,
      { status: 303 },
    );
  }

  const { codeVerifier, codeChallenge } = createPkcePair();
  const callbackUrl = `${origin}/api/auth/callback`;
  const authorizeUrl = buildGoogleOAuthUrl({
    callbackUrl,
    codeChallenge,
  });

  const response = NextResponse.redirect(authorizeUrl, { status: 302 });
  applyOAuthPkceCookie(
    response,
    {
      verifier: codeVerifier,
      next: nextPath,
    },
    request,
  );
  return response;
}
