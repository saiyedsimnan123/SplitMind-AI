import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  OAUTH_PKCE_COOKIE,
  REFRESH_COOKIE,
  SESSION_CREATED_COOKIE,
  SESSION_ID_COOKIE,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/config";

export {
  ACCESS_COOKIE,
  OAUTH_PKCE_COOKIE,
  REFRESH_COOKIE,
  SESSION_CREATED_COOKIE,
  SESSION_ID_COOKIE,
};

export type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  is_anonymous?: boolean;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_color?: string;
    default_currency?: string;
    is_demo?: boolean;
  };
  identities?: unknown[];
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
};

export function getAuthUserDisplayName(user: SupabaseAuthUser | null | undefined): string {
  if (!user) return "SplitMind Member";
  if (isDemoAuthUser(user)) return "Demo Explorer (DEMO)";
  const metaName = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim();
  if (metaName) return metaName;
  if (user.email?.trim()) return user.email.trim();
  if (user.phone?.trim()) {
    const clean = user.phone.trim();
    return `Member ••••${clean.slice(-4)}`;
  }
  return "SplitMind Member";
}

export function isDemoAuthUser(user: SupabaseAuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.is_anonymous === true || user.app_metadata?.provider === "anonymous";
}

export type SupabaseSessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: SupabaseAuthUser;
};

export type VerifiedServerSession = {
  user: SupabaseAuthUser;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  sessionCreatedAt: string;
  refreshed: boolean;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function authHeaders(accessToken?: string): Record<string, string> {
  const anonKey = getSupabaseAnonKey();
  const headers: Record<string, string> = {
    apikey: anonKey,
    "content-type": "application/json",
  };
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

function parseSupabaseError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as Record<string, unknown>;
  const raw =
    (typeof obj.msg === "string" && obj.msg) ||
    (typeof obj.error_description === "string" && obj.error_description) ||
    (typeof obj.message === "string" && obj.message) ||
    (typeof obj.error === "string" && obj.error) ||
    "";
  return raw.trim() || fallback;
}

export function deriveSafeSessionId(accessToken: string): string {
  try {
    const parts = accessToken.split(".");
    if (parts.length >= 2) {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
      const parsed = JSON.parse(payloadJson) as { session_id?: string };
      if (parsed.session_id) {
        const digest = createHash("sha256").update(parsed.session_id).digest("hex").slice(0, 12);
        return `sess_${digest}`;
      }
    }
  } catch {
    // Ignore malformed JWT metadata and derive from token hash.
  }
  const digest = createHash("sha256").update(accessToken).digest("hex").slice(0, 12);
  return `sess_${digest}`;
}

export function createOpaqueSessionId(): string {
  return `sess_${randomBytes(6).toString("hex")}`;
}

export function safeRedirectPath(rawPath: string | null | undefined, fallback = "/"): string {
  if (!rawPath) return fallback;
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  return trimmed;
}

export function isSecureCookieContext(request?: Request | NextRequest): boolean {
  const protoHeader = request?.headers.get("x-forwarded-proto");
  if (protoHeader) return protoHeader.split(",")[0].trim() === "https";
  if (request?.url) {
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      // Ignore invalid URL.
    }
  }
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export function parseDeviceSummary(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown browser";
  const browser =
    /Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os =
    /Windows/.test(userAgent)
      ? "Windows"
      : /Macintosh|Mac OS/.test(userAgent)
        ? "macOS"
        : /Linux/.test(userAgent)
          ? "Linux"
          : /Android/.test(userAgent)
            ? "Android"
            : /iPhone|iPad/.test(userAgent)
              ? "iOS"
              : "Device";
  return `${browser} on ${os}`;
}

export function applySessionCookies(
  response: NextResponse,
  session: {
    accessToken: string;
    refreshToken: string;
    sessionId?: string;
    sessionCreatedAt?: string;
    expiresIn?: number;
    rememberMe?: boolean;
  },
  request?: Request | NextRequest,
) {
  const secure = isSecureCookieContext(request);
  const persistent = session.rememberMe !== false;
  const maxAge = Math.max(300, Math.min(session.expiresIn ?? 3600, 60 * 60 * 24 * 7));
  const refreshMaxAge = 60 * 60 * 24 * 30;
  const sessionId = session.sessionId || deriveSafeSessionId(session.accessToken);
  const createdAt = session.sessionCreatedAt || new Date().toISOString();

  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(persistent ? { maxAge } : {}),
  });
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(persistent ? { maxAge: refreshMaxAge } : {}),
  });
  response.cookies.set(SESSION_ID_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(persistent ? { maxAge: refreshMaxAge } : {}),
  });
  response.cookies.set(SESSION_CREATED_COOKIE, createdAt, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    ...(persistent ? { maxAge: refreshMaxAge } : {}),
  });
}

export function clearSessionCookies(response: NextResponse, request?: Request | NextRequest) {
  const secure = isSecureCookieContext(request);
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_ID_COOKIE, SESSION_CREATED_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 0,
    });
  }
}

export async function signUpWithSupabase(input: {
  email: string;
  password: string;
  fullName: string;
  contactPhone?: string;
  redirectTo?: string;
}) {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const query = input.redirectTo ? `?redirect_to=${encodeURIComponent(input.redirectTo)}` : "";
  const response = await fetch(`${url}/auth/v1/signup${query}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        full_name: input.fullName,
        ...(input.contactPhone ? { contact_phone: input.contactPhone } : {}),
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens> & {
    user?: SupabaseAuthUser;
    id?: string;
    email?: string;
    identities?: unknown[];
  };
  if (!response.ok) {
    throw new Error(parseSupabaseError(data, "Could not create your account."));
  }
  const user: SupabaseAuthUser | null =
    data.user ??
    (typeof data.id === "string"
      ? {
          id: data.id,
          email: data.email ?? input.email,
          identities: data.identities,
          user_metadata: { full_name: input.fullName },
        }
      : null);

  return {
    user,
    duplicateUser: Array.isArray(user?.identities) && user.identities.length === 0,
    session:
      data.access_token && data.refresh_token && user
        ? {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            user,
          }
        : null,
  };
}

export async function verifyEmailOtpWithSupabase(
  email: string,
  token: string,
  type: "signup" | "email" = "signup",
): Promise<SupabaseSessionTokens> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type, email, token }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(parseSupabaseError(data, "The verification code is invalid or has expired."));
  }
  return data as SupabaseSessionTokens;
}

export async function verifySignupOtpWithSupabase(
  email: string,
  token: string,
): Promise<SupabaseSessionTokens> {
  return verifyEmailOtpWithSupabase(email, token, "signup");
}

export async function sendEmailOtpWithSupabase(
  email: string,
  options?: { createUser?: boolean },
): Promise<void> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email,
      create_user: options?.createUser ?? false,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const raw = parseSupabaseError(data, "Could not send the email verification code.");
    if (/signups not allowed for otp/i.test(raw)) {
      throw new Error("No account found with this email. Switch to Create account to sign up.");
    }
    throw new Error(raw);
  }
}

export async function resendSignupOtpWithSupabase(email: string): Promise<void> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/resend`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "signup", email }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(parseSupabaseError(data, "Could not resend the verification code."));
  }
}

export async function sendPhoneOtpWithSupabase(input: {
  phone: string;
  fullName?: string;
  createUser?: boolean;
}): Promise<void> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      phone: input.phone,
      channel: "sms",
      create_user: input.createUser ?? true,
      ...(input.fullName ? { data: { full_name: input.fullName } } : {}),
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const raw = parseSupabaseError(data, "Could not deliver SMS OTP through Supabase Phone Auth.");
    if (/signups not allowed for otp/i.test(raw)) {
      throw new Error("No account found with this phone number. Switch to Create account to register.");
    }
    if (/phone.*disabled|unsupported phone provider/i.test(raw)) {
      throw new Error(
        "Phone OTP (SMS) is disabled in Supabase. Enable Phone Auth with Twilio credentials in Supabase Dashboard.",
      );
    }
    throw new Error(raw);
  }
}

export async function verifyPhoneOtpWithSupabase(
  phone: string,
  token: string,
): Promise<SupabaseSessionTokens> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "sms", phone, token }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(parseSupabaseError(data, "The SMS verification code is invalid or has expired."));
  }
  return data as SupabaseSessionTokens;
}

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildGoogleOAuthUrl(input: {
  callbackUrl: string;
  codeChallenge: string;
}): string {
  const url = getSupabaseUrl();
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: input.callbackUrl,
    code_challenge: input.codeChallenge,
    code_challenge_method: "s256",
    access_type: "offline",
    prompt: "select_account",
  });
  return `${url}/auth/v1/authorize?${params.toString()}`;
}

export async function exchangePkceCodeWithSupabase(
  authCode: string,
  codeVerifier: string,
): Promise<SupabaseSessionTokens> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      auth_code: authCode,
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(parseSupabaseError(data, "Could not complete Google OAuth sign-in with Supabase."));
  }
  return data as SupabaseSessionTokens;
}

export function applyOAuthPkceCookie(
  response: NextResponse,
  payload: { verifier: string; next: string },
  request?: Request | NextRequest,
) {
  response.cookies.set(OAUTH_PKCE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieContext(request),
    path: "/",
    maxAge: 600,
  });
}

export function clearOAuthPkceCookie(response: NextResponse, request?: Request | NextRequest) {
  response.cookies.set(OAUTH_PKCE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieContext(request),
    path: "/",
    maxAge: 0,
  });
}

export function readOAuthPkceCookie(
  request: Request | NextRequest,
): { verifier: string; next: string } | null {
  let raw = "";
  if ("cookies" in request && typeof (request as NextRequest).cookies?.get === "function") {
    raw = (request as NextRequest).cookies.get(OAUTH_PKCE_COOKIE)?.value ?? "";
  } else {
    const header = request.headers.get("cookie") ?? "";
    for (const part of header.split(";")) {
      const idx = part.indexOf("=");
      if (idx > 0 && part.slice(0, idx).trim() === OAUTH_PKCE_COOKIE) {
        const val = part.slice(idx + 1).trim();
        try {
          raw = decodeURIComponent(val);
        } catch {
          raw = val;
        }
        break;
      }
    }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { verifier?: unknown; next?: unknown };
    if (typeof parsed.verifier !== "string" || parsed.verifier.length < 16) return null;
    return {
      verifier: parsed.verifier,
      next: safeRedirectPath(typeof parsed.next === "string" ? parsed.next : "/", "/"),
    };
  } catch {
    return null;
  }
}

export async function signInAnonymouslyForDemo(): Promise<SupabaseSessionTokens> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      data: {
        full_name: "Demo Explorer",
        is_demo: true,
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    const msg = parseSupabaseError(data, "Anonymous demo sessions are not available.");
    if (/anonymous/i.test(msg) && /disabled/i.test(msg)) {
      throw new Error(
        "Anonymous sign-ins are disabled in Supabase. Enable Authentication → Providers → Anonymous Sign-Ins in the Supabase Dashboard.",
      );
    }
    throw new Error(msg);
  }
  return data as SupabaseSessionTokens;
}

export async function signInWithSupabase(email: string, password: string): Promise<SupabaseSessionTokens> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(parseSupabaseError(data, "Invalid email or password."));
  }
  return data as SupabaseSessionTokens;
}

export async function refreshSupabaseSession(refreshToken: string): Promise<SupabaseSessionTokens | null> {
  if (!isSupabaseAuthConfigured() || !refreshToken) return null;
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!data.access_token || !data.refresh_token || !data.user) return null;
  return data as SupabaseSessionTokens;
}

export async function fetchSupabaseUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  if (!isSupabaseAuthConfigured() || !accessToken) return null;
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: authHeaders(accessToken),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as SupabaseAuthUser | null;
  if (!data || typeof data.id !== "string") return null;
  return data;
}

export async function sendSupabasePasswordReset(email: string, redirectTo: string): Promise<void> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, redirect_to: redirectTo }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(parseSupabaseError(data, "Could not send password reset instructions."));
  }
}

export async function verifySupabaseTokenHash(tokenHash: string, type: string): Promise<SupabaseSessionTokens> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ token_hash: tokenHash, type }),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseSessionTokens>;
  if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(parseSupabaseError(data, "The verification or recovery link is invalid or expired."));
  }
  return data as SupabaseSessionTokens;
}

export async function updateSupabaseUser(
  accessToken: string,
  patch: { password?: string; data?: Record<string, unknown> },
): Promise<SupabaseAuthUser> {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured.");
  }
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<SupabaseAuthUser>;
  if (!response.ok || typeof data.id !== "string") {
    throw new Error(parseSupabaseError(data, "Could not update your account credentials."));
  }
  return data as SupabaseAuthUser;
}

export async function revokeSupabaseSession(
  accessToken: string,
  scope: "local" | "others" | "global" = "local",
): Promise<void> {
  if (!isSupabaseAuthConfigured() || !accessToken) return;
  const url = getSupabaseUrl();
  const response = await fetch(`${url}/auth/v1/logout?scope=${encodeURIComponent(scope)}`, {
    method: "POST",
    headers: authHeaders(accessToken),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok && response.status !== 401) {
    const data = await response.json().catch(() => ({}));
    throw new Error(parseSupabaseError(data, "Could not revoke the active session."));
  }
}

export async function verifyServerSessionFromReader(
  reader: CookieReader,
): Promise<VerifiedServerSession | null> {
  if (!isSupabaseAuthConfigured()) return null;

  const accessToken = reader.get(ACCESS_COOKIE)?.value ?? "";
  const refreshToken = reader.get(REFRESH_COOKIE)?.value ?? "";
  const storedSessionId = reader.get(SESSION_ID_COOKIE)?.value ?? "";
  const storedCreatedAt = reader.get(SESSION_CREATED_COOKIE)?.value ?? new Date().toISOString();

  if (accessToken) {
    const user = await fetchSupabaseUser(accessToken);
    if (user) {
      return {
        user,
        accessToken,
        refreshToken,
        sessionId: storedSessionId || deriveSafeSessionId(accessToken),
        sessionCreatedAt: storedCreatedAt,
        refreshed: false,
      };
    }
  }

  if (refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken);
    if (refreshed) {
      return {
        user: refreshed.user,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        sessionId: storedSessionId || deriveSafeSessionId(refreshed.access_token),
        sessionCreatedAt: storedCreatedAt,
        refreshed: true,
      };
    }
  }

  return null;
}

export async function getServerSession(): Promise<VerifiedServerSession | null> {
  const cookieStore = await cookies();
  return verifyServerSessionFromReader(cookieStore);
}

export async function getRequestSession(request: Request): Promise<VerifiedServerSession | null> {
  if ("cookies" in request && typeof (request as NextRequest).cookies?.get === "function") {
    return verifyServerSessionFromReader((request as NextRequest).cookies);
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMap = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex > 0) {
      const key = part.slice(0, eqIndex).trim();
      const rawValue = part.slice(eqIndex + 1).trim();
      try {
        cookieMap.set(key, decodeURIComponent(rawValue));
      } catch {
        cookieMap.set(key, rawValue);
      }
    }
  }
  return verifyServerSessionFromReader({
    get(name: string) {
      const value = cookieMap.get(name);
      return value !== undefined ? { value } : undefined;
    },
  });
}
