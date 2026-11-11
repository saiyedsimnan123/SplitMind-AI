import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as resetPasswordPost } from "@/app/api/auth/reset-password/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as recoverySessionPost } from "@/app/api/auth/recovery-session/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";
import { safeRedirectPath } from "@/lib/supabase/auth";

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
});
