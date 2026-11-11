import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as oauthCallbackGet } from "@/app/api/auth/callback/route";
import { POST as demoPost } from "@/app/api/auth/demo/route";
import { POST as emailOtpSendPost } from "@/app/api/auth/email-otp/send/route";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as googleOAuthGet } from "@/app/api/auth/oauth/google/route";
import { POST as phoneSendOtpPost } from "@/app/api/auth/phone/send-otp/route";
import { POST as phoneVerifyOtpPost } from "@/app/api/auth/phone/verify-otp/route";
import { POST as resendOtpPost } from "@/app/api/auth/resend-otp/route";
import { POST as resetPasswordPost } from "@/app/api/auth/reset-password/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as recoverySessionPost } from "@/app/api/auth/recovery-session/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";
import { POST as verifyOtpPost } from "@/app/api/auth/verify-otp/route";
import { PATCH as profilePatch } from "@/app/api/profile/route";
import { safeRedirectPath } from "@/lib/supabase/auth";
import { resetRateLimitsForTests } from "@/lib/supabase/rate-limit";

const envBackup = {
  url: process.env.SUPABASE_URL,
  anon: process.env.SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function setTestSupabaseEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetRateLimitsForTests();
  if (envBackup.url === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = envBackup.url;
  if (envBackup.anon === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = envBackup.anon;
  if (envBackup.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = envBackup.service;
});

describe("Supabase authentication and session handling", () => {
  it("refuses fake login when Supabase credentials are missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    const response = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "alex@example.com", password: "password123" }),
      }),
    );

    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Supabase Auth is not configured");
  });

  it("sets HttpOnly session cookies on valid login without leaking tokens in JSON and records audit logs", async () => {
    setTestSupabaseEnv();
    const auditPayloads: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/token?grant_type=password")) {
          return Response.json({
            access_token: "header.eyJzZXNzaW9uX2lkIjoic2VzLTEyMyJ9.sig",
            refresh_token: "refresh-secret-token",
            expires_in: 3600,
            user: {
              id: "user-123",
              email: "alex@example.com",
              user_metadata: { full_name: "Alex Kim" },
            },
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "user-123",
              email: "alex@example.com",
              full_name: "Alex Kim",
              initials: "AK",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const response = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Chrome/125.0 Linux" },
        body: JSON.stringify({ email: "alex@example.com", password: "correct-horse-battery" }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.user.email).toBe("alex@example.com");
    expect(JSON.stringify(json)).not.toContain("refresh-secret-token");
    expect(JSON.stringify(json)).not.toContain("eyJzZXNzaW9uX2lk");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sm_access_token=");
    expect(setCookie).toContain("sm_refresh_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Max-Age=");
    expect(auditPayloads.map((e) => e.event_type)).toEqual([
      "auth.login.succeeded",
      "auth.session.created",
    ]);

    const sessionOnlyRes = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Chrome/125.0 Linux" },
        body: JSON.stringify({
          email: "alex@example.com",
          password: "correct-horse-battery",
          rememberMe: false,
        }),
      }),
    );
    expect(sessionOnlyRes.status).toBe(200);
    expect(sessionOnlyRes.headers.get("set-cookie") ?? "").not.toContain("Max-Age=");
  });

  it("logs failed login attempts with masked email and never logs the password", async () => {
    setTestSupabaseEnv();
    const auditPayloads: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/token?grant_type=password")) {
          return Response.json({ error_description: "Invalid login credentials" }, { status: 400 });
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const response = await loginPost(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "alex.kim@example.com", password: "MySecretPassword!99" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(auditPayloads).toHaveLength(1);
    expect(auditPayloads[0].event_type).toBe("auth.login.failed");
    expect(auditPayloads[0].actor_label).toBe("a***m@example.com");
    expect(JSON.stringify(auditPayloads[0])).not.toContain("MySecretPassword!99");
  });

  it("handles signup, forgot-password, reset-password, session verification, and logout scopes", async () => {
    setTestSupabaseEnv();
    const calls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/auth/v1/signup")) {
          return Response.json({ user: { id: "u-new", email: "new@example.com" } });
        }
        if (url.includes("/auth/v1/recover")) {
          return new Response("{}", { status: 200 });
        }
        if (url.includes("/auth/v1/user")) {
          return Response.json({
            id: "u-1",
            email: "alex@example.com",
            user_metadata: { full_name: "Alex Kim" },
          });
        }
        if (url.includes("/auth/v1/logout")) {
          return new Response(null, { status: 204 });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "u-1",
              email: "alex@example.com",
              full_name: "Alex Kim",
              initials: "AK",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          return new Response(null, { status: 201 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const signupRes = await signupPost(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "New User",
          email: "new@example.com",
          password: "StrongPassword123",
        }),
      }),
    );
    expect(signupRes.status).toBe(200);
    expect((await signupRes.json()).requiresEmailConfirmation).toBe(true);

    const forgotRes = await forgotPasswordPost(
      new Request("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "alex@example.com" }),
      }),
    );
    expect(forgotRes.status).toBe(200);

    const resetRes = await resetPasswordPost(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=valid-recovery-jwt; sm_session_id=sess_123",
        },
        body: JSON.stringify({ password: "BrandNewPassword123" }),
      }),
    );
    expect(resetRes.status).toBe(200);

    const sessionRes = await sessionGet(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: "sm_access_token=valid-jwt; sm_session_id=sess_123" },
      }),
    );
    const sessionJson = await sessionRes.json();
    expect(sessionJson.authenticated).toBe(true);
    expect(sessionJson.user.email).toBe("alex@example.com");

    const revokeOthersRes = await logoutPost(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=valid-jwt; sm_session_id=sess_123",
        },
        body: JSON.stringify({ scope: "others" }),
      }),
    );
    expect(revokeOthersRes.status).toBe(200);
    expect(calls.some((u) => u.includes("/auth/v1/logout?scope=others"))).toBe(true);

    const localLogoutRes = await logoutPost(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=valid-jwt; sm_session_id=sess_123",
        },
        body: JSON.stringify({ scope: "local" }),
      }),
    );
    expect(localLogoutRes.status).toBe(200);
    expect(localLogoutRes.headers.get("set-cookie")).toContain("sm_access_token=;");
  });

  it("prevents open redirects in auth redirect helper", () => {
    expect(safeRedirectPath("/reset-password")).toBe("/reset-password");
    expect(safeRedirectPath("//evil.example.com")).toBe("/");
    expect(safeRedirectPath("https://evil.example.com")).toBe("/");
  });

  it("verifies recovery tokens server-side and sets HttpOnly cookies via recovery-session", async () => {
    setTestSupabaseEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({
            id: "u-rec",
            email: "alex@example.com",
            user_metadata: { full_name: "Alex Kim" },
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "u-rec",
              email: "alex@example.com",
              full_name: "Alex Kim",
              initials: "AK",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          return new Response(null, { status: 201 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const res = await recoverySessionPost(
      new Request("http://localhost:3000/api/auth/recovery-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: "rec-access", refreshToken: "rec-refresh" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("sm_access_token=rec-access");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("signup sends 6-digit email OTP without setting premature cookies and rejects duplicate signups (409)", async () => {
    setTestSupabaseEnv();
    const signupPayloads: string[] = [];
    const auditPayloads: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/signup")) {
          const rawBody = String(init?.body ?? "{}");
          signupPayloads.push(rawBody);
          const parsed = JSON.parse(rawBody) as { email?: string };
          if (parsed.email === "existing@example.com") {
            return Response.json({
              id: "dup-1",
              email: "existing@example.com",
              identities: [],
            });
          }
          return Response.json({
            id: "pending-1",
            email: "otp-new@example.com",
            identities: [{ id: "ident-1" }],
          });
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const signupRes = await signupPost(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Priya Nair",
          email: "otp-new@example.com",
          password: "StrongPassword123",
        }),
      }),
    );

    expect(signupRes.status).toBe(200);
    expect(signupRes.headers.get("set-cookie")).toBeNull();
    const signupJson = await signupRes.json();
    expect(signupJson.requiresOtpVerification).toBe(true);
    expect(signupJson.requiresEmailConfirmation).toBe(true);
    expect(signupJson.cooldownSeconds).toBe(60);
    expect(signupPayloads[0]).not.toContain("email_redirect_to");
    expect(auditPayloads.some((e) => e.event_type === "auth.otp.sent")).toBe(true);

    const dupRes = await signupPost(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: "Priya Nair",
          email: "existing@example.com",
          password: "StrongPassword123",
        }),
      }),
    );
    expect(dupRes.status).toBe(409);
  });

  it("verifies 6-digit signup OTP, sets HttpOnly session cookies, and rejects invalid/expired/brute-forced attempts", async () => {
    setTestSupabaseEnv();
    let verifyCalls = 0;
    const verifyBodies: Record<string, unknown>[] = [];
    const auditPayloads: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/verify")) {
          verifyCalls += 1;
          const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
          verifyBodies.push(body);
          if (body.token === "482910" && body.email === "verified@example.com") {
            return Response.json({
              access_token: "header.eyJzZXNzaW9uX2lkIjoic2VzLW90cCJ9.sig",
              refresh_token: "otp-refresh-token",
              expires_in: 3600,
              user: {
                id: "user-otp-1",
                email: "verified@example.com",
                user_metadata: { full_name: "OTP User" },
              },
            });
          }
          if (body.email === "expired@example.com") {
            return Response.json(
              { error_description: "Token has expired or is invalid" },
              { status: 403 },
            );
          }
          return Response.json(
            { error_description: "Invalid token provided" },
            { status: 400 },
          );
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "user-otp-1",
              email: "verified@example.com",
              full_name: "OTP User",
              initials: "OU",
              avatar_color: "blue",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    // 1. Valid 6-digit OTP verification establishes HttpOnly session cookies
    const okRes = await verifyOtpPost(
      new Request("http://localhost:3000/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({ email: "verified@example.com", token: "482910" }),
      }),
    );
    expect(okRes.status).toBe(200);
    expect(verifyBodies[0]).toMatchObject({
      type: "signup",
      email: "verified@example.com",
      token: "482910",
    });
    const okJson = await okRes.json();
    expect(okJson.ok).toBe(true);
    expect(okJson.access_token).toBeUndefined();
    const okCookie = okRes.headers.get("set-cookie") ?? "";
    expect(okCookie).toContain("sm_access_token=header.");
    expect(okCookie).toContain("HttpOnly");
    expect(auditPayloads.some((e) => e.event_type === "auth.otp.verified")).toBe(true);
    expect(auditPayloads.some((e) => e.event_type === "auth.session.created")).toBe(true);

    // 2. Expired OTP returns clear 400 error
    const expRes = await verifyOtpPost(
      new Request("http://localhost:3000/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.2" },
        body: JSON.stringify({ email: "expired@example.com", token: "111222" }),
      }),
    );
    expect(expRes.status).toBe(400);
    expect((await expRes.json()).error).toMatch(/expired/i);

    // 3. Brute-force wrong OTP attempts are blocked with 429 on 6th try
    const callsBefore = verifyCalls;
    for (let i = 0; i < 5; i += 1) {
      const badRes = await verifyOtpPost(
        new Request("http://localhost:3000/api/auth/verify-otp", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.3" },
          body: JSON.stringify({ email: "victim@example.com", token: "000000" }),
        }),
      );
      expect(badRes.status).toBe(400);
    }
    expect(verifyCalls).toBe(callsBefore + 5);

    const blockedRes = await verifyOtpPost(
      new Request("http://localhost:3000/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.3" },
        body: JSON.stringify({ email: "victim@example.com", token: "000000" }),
      }),
    );
    expect(blockedRes.status).toBe(429);
    expect(Number(blockedRes.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(verifyCalls).toBe(callsBefore + 5);
    expect(auditPayloads.some((e) => e.event_type === "auth.otp.rate_limited")).toBe(true);
  });

  it("enforces 60-second resend OTP cooldown and permits resend once cooldown clears", async () => {
    setTestSupabaseEnv();
    const resendBodies: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/signup")) {
          return Response.json({ id: "u-res", email: "resend@example.com", identities: [{ id: "1" }] });
        }
        if (url.includes("/auth/v1/resend")) {
          resendBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
          return Response.json({});
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          return new Response(null, { status: 201 });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const reqHeaders = { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" };
    await signupPost(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          fullName: "Resend Tester",
          email: "resend@example.com",
          password: "StrongPassword123",
        }),
      }),
    );

    const earlyResend = await resendOtpPost(
      new Request("http://localhost:3000/api/auth/resend-otp", {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ email: "resend@example.com" }),
      }),
    );
    expect(earlyResend.status).toBe(429);
    expect(Number(earlyResend.headers.get("Retry-After"))).toBeGreaterThan(0);

    resetRateLimitsForTests();
    const allowedResend = await resendOtpPost(
      new Request("http://localhost:3000/api/auth/resend-otp", {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ email: "resend@example.com" }),
      }),
    );
    expect(allowedResend.status).toBe(200);
    expect(resendBodies[0]).toMatchObject({ type: "signup", email: "resend@example.com" });
  });

  it("launches isolated Supabase anonymous demo sessions seeded with Goa Trip 2026 and blocks demo profile changes", async () => {
    setTestSupabaseEnv();
    const auditPayloads: Record<string, unknown>[] = [];
    const createdGroups: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/signup")) {
          const parsed = JSON.parse(String(init?.body ?? "{}")) as { data?: { is_demo?: boolean } };
          expect(parsed.data?.is_demo).toBe(true);
          return Response.json({
            access_token: "demo.eyJzZXNzaW9uX2lkIjoiZGVtby1zZXNzIn0.sig",
            refresh_token: "demo-refresh-token",
            expires_in: 3600,
            user: {
              id: "demo-anon-uuid",
              is_anonymous: true,
              email: "",
              app_metadata: { provider: "anonymous" },
              user_metadata: { full_name: "Demo Explorer", is_demo: true },
            },
          });
        }
        if (url.includes("/auth/v1/user")) {
          return Response.json({
            id: "demo-anon-uuid",
            is_anonymous: true,
            email: "",
            app_metadata: { provider: "anonymous" },
            user_metadata: { full_name: "Demo Explorer", is_demo: true },
          });
        }
        if (url.includes("/rest/v1/profiles") && (!init?.method || init.method === "GET")) {
          return Response.json([
            {
              id: "demo-anon-uuid",
              email: "",
              full_name: "Demo Explorer",
              initials: "DM",
              avatar_color: "teal",
              default_currency: "INR",
              workspace_initialized: false,
            },
          ]);
        }
        if (url.includes("/rest/v1/groups") && init?.method === "POST") {
          const groupBody = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
          createdGroups.push(groupBody);
          return Response.json([{ id: "goa-seeded-uuid", ...groupBody }], { status: 201 });
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return Response.json([]);
      }),
    );

    const demoRes = await demoPost(
      new Request("http://localhost:3000/api/auth/demo", {
        method: "POST",
        headers: { "user-agent": "Chrome/125.0 Linux" },
      }),
    );

    expect(demoRes.status).toBe(200);
    const demoJson = await demoRes.json();
    expect(demoJson.isDemo).toBe(true);
    expect(demoRes.headers.get("set-cookie")).toContain("sm_access_token=demo.");
    expect(demoRes.headers.get("set-cookie")).toContain("HttpOnly");
    expect(createdGroups.some((g) => g.name === "Goa Trip 2026" && g.total_budget === 40000)).toBe(true);
    expect(auditPayloads.some((e) => e.event_type === "auth.demo.started")).toBe(true);

    const sessionRes = await sessionGet(
      new Request("http://localhost:3000/api/auth/session", {
        headers: { cookie: "sm_access_token=demo-jwt; sm_session_id=demo-sess" },
      }),
    );
    const sessionJson = await sessionRes.json();
    expect(sessionJson.authenticated).toBe(true);
    expect(sessionJson.session.isDemo).toBe(true);
    expect(sessionJson.user.isDemo).toBe(true);

    const profileRes = await profilePatch(
      new Request("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=demo-jwt; sm_session_id=demo-sess",
        },
        body: JSON.stringify({ fullName: "Changed Name" }),
      }),
    );
    expect(profileRes.status).toBe(403);

    const logoutRes = await logoutPost(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=demo-jwt; sm_session_id=demo-sess",
        },
        body: JSON.stringify({ scope: "local" }),
      }),
    );
    expect(logoutRes.status).toBe(200);
    expect(auditPayloads.some((e) => e.event_type === "auth.demo.exited")).toBe(true);
  });

  it("supports passwordless Email OTP login with cooldown and HttpOnly session verification", async () => {
    setTestSupabaseEnv();
    const calls: { url: string; body: Record<string, unknown> }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const parsedBody = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : {};
        calls.push({ url, body: parsedBody });
        if (url.includes("/auth/v1/otp")) {
          return Response.json({});
        }
        if (url.includes("/auth/v1/verify")) {
          return Response.json({
            access_token: "email-otp-access.eyJzZXNzaW9uX2lkIjoic2VzLWVvdHAifQ.sig",
            refresh_token: "email-otp-refresh",
            expires_in: 3600,
            user: {
              id: "user-email-otp",
              email: "meera@example.com",
              user_metadata: { full_name: "Meera Rao" },
            },
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "user-email-otp",
              email: "meera@example.com",
              full_name: "Meera Rao",
              initials: "MR",
              avatar_color: "teal",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          return new Response(null, { status: 201 });
        }
        return Response.json([]);
      }),
    );

    const sendRes = await emailOtpSendPost(
      new Request("http://localhost:3000/api/auth/email-otp/send", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.1.0.1" },
        body: JSON.stringify({ email: "meera@example.com" }),
      }),
    );
    expect(sendRes.status).toBe(200);
    expect(sendRes.headers.get("set-cookie")).toBeNull();
    const otpReq = calls.find((c) => c.url.includes("/auth/v1/otp"));
    expect(otpReq?.body).toMatchObject({ email: "meera@example.com", create_user: false });

    const cooldownRes = await resendOtpPost(
      new Request("http://localhost:3000/api/auth/resend-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.1.0.1" },
        body: JSON.stringify({ email: "meera@example.com", mode: "login" }),
      }),
    );
    expect(cooldownRes.status).toBe(429);

    const verifyRes = await verifyOtpPost(
      new Request("http://localhost:3000/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.1.0.1" },
        body: JSON.stringify({ email: "meera@example.com", token: "741852", mode: "login" }),
      }),
    );
    expect(verifyRes.status).toBe(200);
    const verifyCall = calls.find((c) => c.url.includes("/auth/v1/verify"));
    expect(verifyCall?.body).toMatchObject({
      type: "email",
      email: "meera@example.com",
      token: "741852",
    });
    expect(verifyRes.headers.get("set-cookie")).toContain("sm_access_token=email-otp-access.");
    expect(verifyRes.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("supports Phone OTP (+91 default & Twilio/Supabase), handles errors/expiry, and rate-limits brute force", async () => {
    setTestSupabaseEnv();
    let verifyAttempts = 0;
    const auditPayloads: Record<string, unknown>[] = [];
    const profileQueries: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
        if (url.includes("/auth/v1/otp")) {
          if (body.phone === "+919999900000") {
            return Response.json({ msg: "Phone provider is disabled" }, { status: 422 });
          }
          return Response.json({});
        }
        if (url.includes("/auth/v1/verify")) {
          verifyAttempts += 1;
          if (body.phone === "+919876543210" && body.token === "654321") {
            return Response.json({
              access_token: "phone-jwt.eyJzZXNzaW9uX2lkIjoic2VzLXBob25lIn0.sig",
              refresh_token: "phone-refresh",
              expires_in: 3600,
              user: {
                id: "phone-user-1",
                email: "",
                phone: "919876543210",
                app_metadata: { provider: "phone" },
                user_metadata: { full_name: "Rohan Verma" },
              },
            });
          }
          if (body.phone === "+919876543211") {
            return Response.json({ error_description: "Token has expired" }, { status: 403 });
          }
          return Response.json({ error_description: "Invalid otp" }, { status: 400 });
        }
        if (url.includes("/rest/v1/profiles")) {
          profileQueries.push(url);
          if (!init?.method || init.method === "GET") {
            return Response.json([]);
          }
          return Response.json([
            {
              id: "phone-user-1",
              email: "",
              full_name: "Rohan Verma",
              initials: "RV",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: false,
            },
          ]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(body);
          return new Response(null, { status: 201 });
        }
        return Response.json([]);
      }),
    );

    // 1. Never simulates SMS delivery if Supabase Phone Auth returns an error
    const disabledRes = await phoneSendOtpPost(
      new Request("http://localhost:3000/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.1" },
        body: JSON.stringify({ countryCode: "+91", localNumber: "9999900000", mode: "signup" }),
      }),
    );
    expect(disabledRes.status).toBe(503);

    // 2. Rejects invalid Indian mobile format before calling Supabase
    const badPhoneRes = await phoneSendOtpPost(
      new Request("http://localhost:3000/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.1" },
        body: JSON.stringify({ countryCode: "+91", localNumber: "12345", mode: "signup" }),
      }),
    );
    expect(badPhoneRes.status).toBe(400);

    // 3. Sends SMS OTP without setting session cookie and enforces cooldown
    const sendRes = await phoneSendOtpPost(
      new Request("http://localhost:3000/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.2" },
        body: JSON.stringify({
          countryCode: "+91",
          localNumber: "98765 43210",
          fullName: "Rohan Verma",
          mode: "signup",
        }),
      }),
    );
    expect(sendRes.status).toBe(200);
    expect(sendRes.headers.get("set-cookie")).toBeNull();
    const sendJson = await sendRes.json();
    expect(sendJson.phone).toBe("+919876543210");
    expect(sendJson.cooldownSeconds).toBe(60);

    const earlyResend = await phoneSendOtpPost(
      new Request("http://localhost:3000/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.2" },
        body: JSON.stringify({ countryCode: "+91", localNumber: "9876543210", mode: "signup" }),
      }),
    );
    expect(earlyResend.status).toBe(429);

    // 4. Verifies valid SMS OTP, creates profile strictly by authUser.id, masks phone in audit logs
    const verifyOk = await phoneVerifyOtpPost(
      new Request("http://localhost:3000/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.2" },
        body: JSON.stringify({ phone: "+919876543210", token: "654321" }),
      }),
    );
    expect(verifyOk.status).toBe(200);
    const verifyOkJson = await verifyOk.json();
    expect(verifyOkJson.access_token).toBeUndefined();
    expect(verifyOkJson.user.phone).toBe("+919876543210");
    expect(verifyOk.headers.get("set-cookie")).toContain("sm_access_token=phone-jwt.");
    expect(verifyOk.headers.get("set-cookie")).toContain("HttpOnly");
    expect(profileQueries[0]).toContain("id=eq.phone-user-1");
    expect(auditPayloads.some((e) => String(e.actor_label).includes("+91••••3210"))).toBe(true);

    // 5. Handles expired phone OTP cleanly
    const expRes = await phoneVerifyOtpPost(
      new Request("http://localhost:3000/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.3" },
        body: JSON.stringify({ phone: "+919876543211", token: "111222" }),
      }),
    );
    expect(expRes.status).toBe(400);
    expect((await expRes.json()).error).toMatch(/expired/i);

    // 6. Prevents phone OTP brute-force attempts with 429 on 6th failure
    const beforeAttempts = verifyAttempts;
    for (let i = 0; i < 5; i += 1) {
      const bad = await phoneVerifyOtpPost(
        new Request("http://localhost:3000/api/auth/phone/verify-otp", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.4" },
          body: JSON.stringify({ phone: "+919876543219", token: "000000" }),
        }),
      );
      expect(bad.status).toBe(400);
    }
    expect(verifyAttempts).toBe(beforeAttempts + 5);

    const locked = await phoneVerifyOtpPost(
      new Request("http://localhost:3000/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.2.0.4" },
        body: JSON.stringify({ phone: "+919876543219", token: "000000" }),
      }),
    );
    expect(locked.status).toBe(429);
    expect(verifyAttempts).toBe(beforeAttempts + 5);
  });

  it("handles Google OAuth PKCE redirect, verified callback provisioning without duplicates, and cancellation", async () => {
    setTestSupabaseEnv();
    const auditPayloads: Record<string, unknown>[] = [];
    const createdGroups: Record<string, unknown>[] = [];
    let isReturningUser = false;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/token?grant_type=pkce")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            auth_code?: string;
            code_verifier?: string;
          };
          expect(body.auth_code).toBe("google-auth-code-123");
          expect(body.code_verifier?.length).toBeGreaterThanOrEqual(32);
          return Response.json({
            access_token: "google-jwt.eyJzZXNzaW9uX2lkIjoic2VzLWdvb2dsZSJ9.sig",
            refresh_token: "google-refresh-token",
            expires_in: 3600,
            user: {
              id: "google-user-1",
              email: "ananya@gmail.com",
              app_metadata: { provider: "google", providers: ["google"] },
              user_metadata: { name: "Ananya Kapoor", full_name: "Ananya Kapoor" },
            },
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          expect(url).not.toContain("ananya@gmail.com");
          if (isReturningUser) {
            return Response.json([
              {
                id: "google-user-1",
                email: "ananya@gmail.com",
                full_name: "Ananya Kapoor",
                initials: "AK",
                avatar_color: "teal",
                default_currency: "INR",
                workspace_initialized: true,
              },
            ]);
          }
          if (!init?.method || init.method === "GET") {
            return Response.json([]);
          }
          return Response.json([
            {
              id: "google-user-1",
              email: "ananya@gmail.com",
              full_name: "Ananya Kapoor",
              initials: "AK",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: false,
            },
          ]);
        }
        if (url.includes("/rest/v1/groups") && init?.method === "POST") {
          const groupBody = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
          createdGroups.push(groupBody);
          return Response.json([{ id: "goa-google-seed", ...groupBody }], { status: 201 });
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          auditPayloads.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return Response.json([]);
      }),
    );

    // 1. OAuth start sets HttpOnly PKCE cookie and redirects to Supabase Google provider
    const startRes = await googleOAuthGet(
      new Request("http://localhost:3000/api/auth/oauth/google?next=/dashboard"),
    );
    expect(startRes.status).toBe(302);
    const authorizeLocation = startRes.headers.get("location") ?? "";
    expect(authorizeLocation).toContain("https://example.supabase.co/auth/v1/authorize");
    expect(authorizeLocation).toContain("provider=google");
    expect(authorizeLocation).toContain("code_challenge_method=s256");
    expect(authorizeLocation).toContain(encodeURIComponent("http://localhost:3000/api/auth/callback"));

    const pkceSetCookie = startRes.headers.get("set-cookie") ?? "";
    expect(pkceSetCookie).toContain("sm_oauth_pkce=");
    expect(pkceSetCookie).toContain("HttpOnly");
    const pkceCookiePair = pkceSetCookie.split(";")[0];

    // 2. Callback exchanges PKCE code, provisions profile + seeds Goa workspace for new user, sets HttpOnly cookies
    const callbackNewRes = await oauthCallbackGet(
      new Request("http://localhost:3000/api/auth/callback?code=google-auth-code-123", {
        headers: { cookie: pkceCookiePair },
      }),
    );
    expect(callbackNewRes.status).toBe(303);
    expect(callbackNewRes.headers.get("location")).toBe("http://localhost:3000/dashboard");
    const callbackCookies = callbackNewRes.headers.get("set-cookie") ?? "";
    expect(callbackCookies).toContain("sm_access_token=google-jwt.");
    expect(callbackCookies).toContain("HttpOnly");
    expect(callbackCookies).toContain("sm_oauth_pkce=;");
    expect(createdGroups.some((g) => g.name === "Goa Trip 2026")).toBe(true);
    expect(auditPayloads.some((e) => e.event_type === "auth.oauth.succeeded")).toBe(true);

    // 3. Returning Google user fetches existing profile without duplicating profile or re-seeding groups
    const groupsCountAfterFirst = createdGroups.length;
    isReturningUser = true;
    const callbackExistingRes = await oauthCallbackGet(
      new Request("http://localhost:3000/api/auth/callback?code=google-auth-code-123", {
        headers: { cookie: pkceCookiePair },
      }),
    );
    expect(callbackExistingRes.status).toBe(303);
    expect(createdGroups.length).toBe(groupsCountAfterFirst);

    // 4. Rejects callback without matching PKCE verifier cookie (CSRF protection)
    const missingPkceRes = await oauthCallbackGet(
      new Request("http://localhost:3000/api/auth/callback?code=stolen-code"),
    );
    expect(missingPkceRes.status).toBe(303);
    expect(missingPkceRes.headers.get("location")).toContain("/login?error=");

    // 5. Gracefully handles Google OAuth cancellation
    const cancelledRes = await oauthCallbackGet(
      new Request("http://localhost:3000/api/auth/callback?error=access_denied", {
        headers: { cookie: pkceCookiePair },
      }),
    );
    expect(cancelledRes.status).toBe(303);
    expect(cancelledRes.headers.get("location")).toContain("Google%20sign-in%20was%20cancelled");
    expect(auditPayloads.some((e) => e.event_type === "auth.oauth.failed")).toBe(true);
  });
});
