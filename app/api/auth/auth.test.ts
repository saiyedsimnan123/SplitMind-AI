import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as confirmGet } from "@/app/api/auth/confirm/route";
import { POST as demoPost } from "@/app/api/auth/demo/route";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as recoverySessionPost } from "@/app/api/auth/recovery-session/route";
import { POST as resetPasswordPost } from "@/app/api/auth/reset-password/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";
import { PATCH as profilePatch } from "@/app/api/profile/route";
import { validateAndFormatPhone, validateE164Phone } from "@/lib/phone";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_CREATED_COOKIE,
  SESSION_ID_COOKIE,
  safeRedirectPath,
} from "@/lib/supabase/auth";
import { getCanonicalOrigin } from "@/lib/supabase/config";
import { ensureUserProfile } from "@/lib/supabase/db";
import { middleware } from "@/middleware";

const ORIGINAL_ENV = { ...process.env };

function mockSupabaseEnv() {
  process.env.SUPABASE_URL = "https://mock-project.supabase.co";
  process.env.SUPABASE_ANON_KEY = "mock-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key";
  process.env.APP_URL = "https://splitmind.example";
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_URL;
}

function getSetCookies(response: Response): string[] {
  const headersWithGetSetCookie = response.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    return headersWithGetSetCookie.getSetCookie();
  }
  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

function buildCookieHeader(pairs: Record<string, string>): string {
  return Object.entries(pairs)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("; ");
}

describe("SplitMind AI email-and-password authentication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("fails closed with 503 when Supabase auth environment variables are missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const loginRes = await loginPost(
      new Request("https://splitmind.example/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "aarav@example.com", password: "Password123!" }),
      }),
    );
    expect(loginRes.status).toBe(503);

    const signupRes = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav Sharma",
          email: "aarav@example.com",
          password: "Password123!",
        }),
      }),
    );
    expect(signupRes.status).toBe(503);
  });

  it("signs in with email and password, sets HttpOnly cookies, and hides raw tokens from JSON", async () => {
    mockSupabaseEnv();
    const auditPayloads: string[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/token?grant_type=password")) {
        return new Response(
          JSON.stringify({
            access_token: "jwt-access-token",
            refresh_token: "jwt-refresh-token",
            expires_in: 3600,
            user: {
              id: "user-123",
              email: "aarav@example.com",
              app_metadata: { provider: "email" },
              user_metadata: { full_name: "Aarav Sharma" },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/rest/v1/profiles?id=eq.user-123")) {
        return new Response(
          JSON.stringify([
            {
              id: "user-123",
              email: "aarav@example.com",
              phone: "",
              full_name: "Aarav Sharma",
              initials: "AS",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        auditPayloads.push(String(init?.body ?? ""));
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await loginPost(
      new Request("https://splitmind.example/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0 Chrome/125.0",
        },
        body: JSON.stringify({
          email: "AARAV@example.com",
          password: "Password123!",
          rememberMe: true,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const bodyText = await res.text();
    const json = JSON.parse(bodyText) as { user: { id: string; email: string }; session: { sessionId: string } };
    expect(json.user.id).toBe("user-123");
    expect(json.user.email).toBe("aarav@example.com");
    expect(bodyText).not.toContain("jwt-access-token");
    expect(bodyText).not.toContain("jwt-refresh-token");

    const cookies = getSetCookies(res).join("\n");
    expect(cookies).toContain(`${ACCESS_COOKIE}=jwt-access-token`);
    expect(cookies).toContain(`${REFRESH_COOKIE}=jwt-refresh-token`);
    expect(cookies).toContain("HttpOnly");
    expect(cookies.toLowerCase()).toContain("samesite=lax");
    expect(cookies).toContain("Max-Age=3600");
    expect(auditPayloads.some((item) => item.includes("auth.login.succeeded"))).toBe(true);
  });

  it("returns 401 on invalid password login and masks email in audit logs without logging password", async () => {
    mockSupabaseEnv();
    const auditPayloads: string[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/token?grant_type=password")) {
        return new Response(JSON.stringify({ error_description: "Invalid login credentials" }), { status: 400 });
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        auditPayloads.push(String(init?.body ?? ""));
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await loginPost(
      new Request("https://splitmind.example/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "aarav.sharma@example.com", password: "SuperSecretWrongPassword99" }),
      }),
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Invalid login credentials");
    expect(getSetCookies(res)).toHaveLength(0);
    expect(auditPayloads.join("\n")).toContain("auth.login.failed");
    expect(auditPayloads.join("\n")).not.toContain("SuperSecretWrongPassword99");
  });

  it("creates an account immediately without phone or OTP and sets HttpOnly session cookies", async () => {
    mockSupabaseEnv();
    let insertedProfileBody = "";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/signup")) {
        const sent = JSON.parse(String(init?.body ?? "{}")) as {
          email: string;
          data: { full_name: string; contact_phone?: string };
        };
        expect(sent.email).toBe("diya@example.com");
        expect(sent.data.full_name).toBe("Diya Nair");
        expect(sent.data.contact_phone).toBeUndefined();
        return new Response(
          JSON.stringify({
            access_token: "signup-access-token",
            refresh_token: "signup-refresh-token",
            expires_in: 3600,
            user: {
              id: "user-diya",
              email: "diya@example.com",
              identities: [{ id: "id-1" }],
              user_metadata: { full_name: "Diya Nair" },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/rest/v1/profiles?id=eq.user-diya")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/rest/v1/profiles") && init?.method === "POST") {
        insertedProfileBody = String(init.body ?? "");
        return new Response(
          JSON.stringify([
            {
              id: "user-diya",
              email: "diya@example.com",
              phone: "",
              full_name: "Diya Nair",
              initials: "DN",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: false,
            },
          ]),
          { status: 201 },
        );
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Diya Nair",
          email: "diya@example.com",
          password: "StrongPassword!23",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      user: { id: string; email: string; fullName: string };
      requiresVerification?: boolean;
    };
    expect(json.ok).toBe(true);
    expect(json.requiresVerification).toBeUndefined();
    expect(json.user.email).toBe("diya@example.com");
    expect(insertedProfileBody).not.toContain('"phone"');

    const cookies = getSetCookies(res).join("\n");
    expect(cookies).toContain(`${ACCESS_COOKIE}=signup-access-token`);
    expect(cookies).toContain(`${REFRESH_COOKIE}=signup-refresh-token`);
    expect(cookies).toContain("HttpOnly");
  });

  it("normalizes optional E.164 phone during signup and persists it without verification", async () => {
    mockSupabaseEnv();
    let insertedProfileBody = "";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/profiles?phone=eq.")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/auth/v1/signup")) {
        const sent = JSON.parse(String(init?.body ?? "{}")) as {
          data: { contact_phone?: string };
        };
        expect(sent.data.contact_phone).toBe("+919876543210");
        return new Response(
          JSON.stringify({
            access_token: "phone-access-token",
            refresh_token: "phone-refresh-token",
            expires_in: 3600,
            user: {
              id: "user-rohan",
              email: "rohan@example.com",
              identities: [{ id: "id-2" }],
              user_metadata: { full_name: "Rohan Verma", contact_phone: "+919876543210" },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/rest/v1/profiles?id=eq.user-rohan")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/rest/v1/profiles") && init?.method === "POST") {
        insertedProfileBody = String(init.body ?? "");
        return new Response(
          JSON.stringify([
            {
              id: "user-rohan",
              email: "rohan@example.com",
              phone: "+919876543210",
              full_name: "Rohan Verma",
              initials: "RV",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: false,
            },
          ]),
          { status: 201 },
        );
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Rohan Verma",
          email: "rohan@example.com",
          phone: "+91 98765 43210",
          password: "StrongPassword!23",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; user: { phone: string } };
    expect(json.ok).toBe(true);
    expect(json.user.phone).toBe("+919876543210");
    expect(insertedProfileBody).toContain("+919876543210");
  });

  it("rejects duplicate optional phone numbers with 409 before creating an auth user", async () => {
    mockSupabaseEnv();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/profiles?phone=eq.")) {
        return new Response(JSON.stringify([{ id: "existing-user" }]), { status: 200 });
      }
      throw new Error(`Should not call ${url} after duplicate phone detection`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Duplicate Phone",
          email: "newuser@example.com",
          phone: "+919876543210",
          password: "StrongPassword!23",
        }),
      }),
    );

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("already linked to another SplitMind account");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate email signups with 409 and avoids overwriting another user's phone on DB unique conflict", async () => {
    mockSupabaseEnv();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/signup")) {
        return new Response(
          JSON.stringify({
            user: { id: "user-dup", email: "existing@example.com", identities: [] },
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const dupEmailRes = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Existing User",
          email: "existing@example.com",
          password: "StrongPassword!23",
        }),
      }),
    );
    expect(dupEmailRes.status).toBe(409);

    let attempts = 0;
    const insertBodies: string[] = [];
    const profileConflictFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/profiles?id=eq.user-9")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/rest/v1/profiles") && init?.method === "POST") {
        attempts += 1;
        insertBodies.push(String(init.body ?? ""));
        if (attempts === 1) {
          return new Response(
            JSON.stringify({ message: 'duplicate key value violates unique constraint "uq_profiles_phone"' }),
            { status: 409 },
          );
        }
        return new Response(
          JSON.stringify([
            {
              id: "user-9",
              email: "nina@example.com",
              phone: "",
              full_name: "Nina",
              initials: "NI",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: false,
            },
          ]),
          { status: 201 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", profileConflictFetch);

    const ensured = await ensureUserProfile("access-token", {
      id: "user-9",
      email: "nina@example.com",
      user_metadata: { full_name: "Nina", contact_phone: "+919999988888" },
    });
    expect(attempts).toBe(2);
    expect(insertBodies[0]).toContain("+919999988888");
    expect(insertBodies[1]).not.toContain("+919999988888");
    expect(ensured.profile.id).toBe("user-9");
  });

  it("returns 503 with Dashboard guidance if Supabase still has Confirm email enabled", async () => {
    mockSupabaseEnv();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/signup")) {
        return new Response(
          JSON.stringify({
            user: { id: "user-unconfirmed", email: "wait@example.com", identities: [{ id: "id-3" }] },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/auth/v1/token?grant_type=password")) {
        return new Response(JSON.stringify({ error_description: "Email not confirmed" }), { status: 400 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Wait User",
          email: "wait@example.com",
          password: "StrongPassword!23",
        }),
      }),
    );

    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Confirm email");
    expect(getSetCookies(res)).toHaveLength(0);
  });

  it("validates signup inputs and optional E.164 phone format", async () => {
    mockSupabaseEnv();
    const invalidPhoneRes = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav",
          email: "aarav@example.com",
          phone: "123",
          password: "StrongPassword!23",
        }),
      }),
    );
    expect(invalidPhoneRes.status).toBe(400);

    const shortPwRes = await signupPost(
      new Request("https://splitmind.example/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Aarav",
          email: "aarav@example.com",
          password: "short",
        }),
      }),
    );
    expect(shortPwRes.status).toBe(400);

    expect(validateAndFormatPhone("+91", "98765 43210")).toEqual({
      ok: true,
      e164: "+919876543210",
      countryCode: "+91",
      nationalNumber: "9876543210",
    });
    expect(validateE164Phone("+14155550199")).toEqual({
      ok: true,
      e164: "+14155550199",
      countryCode: "+1",
      nationalNumber: "4155550199",
    });
    expect(validateE164Phone("not-a-phone").ok).toBe(false);
  });

  it("sends forgot-password recovery emails pointing to active Vercel preview /reset-password", async () => {
    mockSupabaseEnv();
    process.env.VERCEL_ENV = "preview";
    let capturedUrl = "";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/recover")) {
        capturedUrl = url;
        return new Response(JSON.stringify({}), { status: 200 });
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        expect(String(init?.body ?? "")).toContain("auth.password_reset.requested");
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("https://splitmind.example/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-host": "splitmind-ai-git-hackathon-splitmind-ai-saiyedsimnan123.vercel.app",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ email: "aarav@example.com" }),
    });

    expect(getCanonicalOrigin(req.url, req)).toBe(
      "https://splitmind-ai-git-hackathon-splitmind-ai-saiyedsimnan123.vercel.app",
    );

    const res = await forgotPasswordPost(req);
    expect(res.status).toBe(200);
    expect(decodeURIComponent(capturedUrl)).toContain(
      "redirect_to=https://splitmind-ai-git-hackathon-splitmind-ai-saiyedsimnan123.vercel.app/reset-password",
    );
  });

  it("handles confirm recovery links, rejects non-recovery confirm types, establishes recovery session, and resets passwords", async () => {
    mockSupabaseEnv();

    const nonRecoveryRes = await confirmGet(
      new Request("https://splitmind.example/api/auth/confirm?token_hash=abc&type=signup"),
    );
    expect(nonRecoveryRes.status).toBe(303);
    expect(nonRecoveryRes.headers.get("location")).toContain("/login?error=");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/verify")) {
        return new Response(
          JSON.stringify({
            access_token: "rec-access-token",
            refresh_token: "rec-refresh-token",
            expires_in: 3600,
            user: { id: "user-123", email: "aarav@example.com", user_metadata: { full_name: "Aarav Sharma" } },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/auth/v1/user") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({ id: "user-123", email: "aarav@example.com", user_metadata: { full_name: "Aarav Sharma" } }),
          { status: 200 },
        );
      }
      if (url.endsWith("/auth/v1/user") && init?.method === "PUT") {
        return new Response(
          JSON.stringify({ id: "user-123", email: "aarav@example.com", user_metadata: { full_name: "Aarav Sharma" } }),
          { status: 200 },
        );
      }
      if (url.includes("/rest/v1/profiles?id=eq.user-123")) {
        return new Response(
          JSON.stringify([
            {
              id: "user-123",
              email: "aarav@example.com",
              phone: "",
              full_name: "Aarav Sharma",
              initials: "AS",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const recoveryRes = await confirmGet(
      new Request("https://splitmind.example/api/auth/confirm?token_hash=rec-hash&type=recovery"),
    );
    expect(recoveryRes.status).toBe(303);
    expect(recoveryRes.headers.get("location")).toBe("https://splitmind.example/reset-password");
    expect(getSetCookies(recoveryRes).join("\n")).toContain(`${ACCESS_COOKIE}=rec-access-token`);

    const exchangeRes = await recoverySessionPost(
      new Request("https://splitmind.example/api/auth/recovery-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: "rec-access-token", refreshToken: "rec-refresh-token" }),
      }),
    );
    expect(exchangeRes.status).toBe(200);
    expect(getSetCookies(exchangeRes).join("\n")).toContain(`${ACCESS_COOKIE}=rec-access-token`);

    const resetRes = await resetPasswordPost(
      new Request("https://splitmind.example/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: buildCookieHeader({
            [ACCESS_COOKIE]: "rec-access-token",
            [REFRESH_COOKIE]: "rec-refresh-token",
            [SESSION_ID_COOKIE]: "sess_rec",
            [SESSION_CREATED_COOKIE]: "2026-11-11T00:00:00.000Z",
          }),
        },
        body: JSON.stringify({ password: "NewStrongPassword!99" }),
      }),
    );
    expect(resetRes.status).toBe(200);
  });

  it("reports session details accurately and handles local, others, and global logout scopes", async () => {
    mockSupabaseEnv();
    const revokedScopes: string[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) {
        return new Response(
          JSON.stringify({
            id: "user-123",
            email: "aarav@example.com",
            app_metadata: { provider: "email" },
            user_metadata: { full_name: "Aarav Sharma" },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/rest/v1/profiles?id=eq.user-123")) {
        return new Response(
          JSON.stringify([
            {
              id: "user-123",
              email: "aarav@example.com",
              phone: "",
              full_name: "Aarav Sharma",
              initials: "AS",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]),
          { status: 200 },
        );
      }
      if (url.includes("/auth/v1/logout")) {
        revokedScopes.push(new URL(url).searchParams.get("scope") ?? "local");
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const cookieHeader = buildCookieHeader({
      [ACCESS_COOKIE]: "valid-access-token",
      [REFRESH_COOKIE]: "valid-refresh-token",
      [SESSION_ID_COOKIE]: "sess_123",
      [SESSION_CREATED_COOKIE]: "2026-11-11T00:00:00.000Z",
    });

    const sessionRes = await sessionGet(
      new Request("https://splitmind.example/api/auth/session", { headers: { cookie: cookieHeader } }),
    );
    expect(sessionRes.status).toBe(200);
    const sessionJson = (await sessionRes.json()) as {
      authenticated: boolean;
      session: { provider: string };
    };
    expect(sessionJson.authenticated).toBe(true);
    expect(sessionJson.session.provider).toBe("Email & Password (Supabase Auth · HttpOnly)");

    const othersRes = await logoutPost(
      new Request("https://splitmind.example/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieHeader },
        body: JSON.stringify({ scope: "others" }),
      }),
    );
    expect(othersRes.status).toBe(200);
    expect(getSetCookies(othersRes)).toHaveLength(0);

    const globalRes = await logoutPost(
      new Request("https://splitmind.example/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieHeader },
        body: JSON.stringify({ scope: "global" }),
      }),
    );
    expect(globalRes.status).toBe(200);
    expect(getSetCookies(globalRes).join("\n")).toContain(`${ACCESS_COOKIE}=;`);
    expect(revokedScopes).toEqual(["others", "global"]);
  });

  it("starts isolated Explore Demo sessions with Goa Trip 2026 and blocks demo credential mutations", async () => {
    mockSupabaseEnv();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/signup")) {
        return new Response(
          JSON.stringify({
            access_token: "demo-access-token",
            refresh_token: "demo-refresh-token",
            expires_in: 3600,
            user: {
              id: "demo-user-1",
              is_anonymous: true,
              app_metadata: { provider: "anonymous" },
              user_metadata: { full_name: "Demo Explorer", is_demo: true },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/rest/v1/profiles?id=eq.demo-user-1")) {
        return new Response(
          JSON.stringify([
            {
              id: "demo-user-1",
              email: "",
              phone: "",
              full_name: "Demo Explorer",
              initials: "DM",
              avatar_color: "teal",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]),
          { status: 200 },
        );
      }
      if (url.endsWith("/auth/v1/user")) {
        return new Response(
          JSON.stringify({
            id: "demo-user-1",
            is_anonymous: true,
            app_metadata: { provider: "anonymous" },
            user_metadata: { full_name: "Demo Explorer", is_demo: true },
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/rest/v1/security_audit_events")) {
        expect(String(init?.body ?? "")).toContain("auth.demo.started");
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const demoRes = await demoPost(
      new Request("https://splitmind.example/api/auth/demo", {
        method: "POST",
      }),
    );
    expect(demoRes.status).toBe(200);
    const demoJson = (await demoRes.json()) as { ok: boolean; isDemo: boolean };
    expect(demoJson.ok).toBe(true);
    expect(demoJson.isDemo).toBe(true);
    expect(getSetCookies(demoRes).join("\n")).toContain(`${ACCESS_COOKIE}=demo-access-token`);

    const patchDemoRes = await profilePatch(
      new Request("https://splitmind.example/api/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: buildCookieHeader({ [ACCESS_COOKIE]: "demo-access-token" }),
        },
        body: JSON.stringify({ fullName: "Attempted Rename" }),
      }),
    );
    expect(patchDemoRes.status).toBe(403);
  });

  it("blocks open redirects in safeRedirectPath and allows public auth routes through middleware", async () => {
    mockSupabaseEnv();

    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("/reset-password")).toBe("/reset-password");

    for (const pathname of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
      const res = middleware(new NextRequest(`https://splitmind.example${pathname}`));
      expect(res.status).toBe(200);
    }

    const protectedRes = middleware(new NextRequest("https://splitmind.example/"));
    expect(protectedRes.status).toBe(307);
    expect(protectedRes.headers.get("location")).toBe("https://splitmind.example/login");
  });
});
