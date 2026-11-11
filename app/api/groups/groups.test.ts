import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as groupsGet, POST as groupsPost } from "@/app/api/groups/route";
import { PATCH as groupPatch } from "@/app/api/groups/[groupId]/route";
import { POST as paypalOrderPost } from "@/app/api/payments/orders/route";
import {
  DELETE as securityDelete,
  GET as securityGet,
  PATCH as securityPatch,
  POST as securityPost,
} from "@/app/api/security/events/route";
import { middleware } from "@/middleware";

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

describe("Route protection, group isolation, permissions, and audit immutability", () => {
  it("redirects unauthenticated workspace visitors and blocks unauthenticated API requests via middleware", () => {
    setTestSupabaseEnv();

    const homeRes = middleware(new NextRequest("http://localhost:3000/"));
    expect(homeRes.status).toBe(307);
    expect(homeRes.headers.get("location")).toContain("/login");

    const apiRes = middleware(new NextRequest("http://localhost:3000/api/groups"));
    expect(apiRes.status).toBe(401);

    const loginRes = middleware(new NextRequest("http://localhost:3000/login"));
    expect(loginRes.status).toBe(200);
  });

  it("rejects unauthenticated requests across groups, security audit, and authenticated PayPal endpoints", async () => {
    setTestSupabaseEnv();

    const gRes = await groupsGet(new Request("http://localhost:3000/api/groups"));
    expect(gRes.status).toBe(401);

    const sRes = await securityGet(new Request("http://localhost:3000/api/security/events"));
    expect(sRes.status).toBe(401);

    const pRes = await paypalOrderPost(
      new Request("http://localhost:3000/api/payments/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: "10.00",
          idempotencyKey: "a0b1c2d3-e4f5-4678-9012-123456789012",
        }),
      }),
    );
    expect(pRes.status).toBe(401);
  });

  it("enforces membership and organizer permissions on group mutations and ignores client-supplied owner IDs", async () => {
    setTestSupabaseEnv();
    let insertedOwnerId: unknown = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({
            id: "user-real-123",
            email: "alex@example.com",
            user_metadata: { full_name: "Alex Kim" },
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "user-real-123",
              email: "alex@example.com",
              full_name: "Alex Kim",
              initials: "AK",
              avatar_color: "coral",
              default_currency: "INR",
              workspace_initialized: true,
            },
          ]);
        }
        if (url.includes("/rest/v1/groups?id=eq.foreign-group")) {
          // RLS returns empty array for groups the user does not belong to
          return Response.json([]);
        }
        if (url.includes("/rest/v1/groups?id=eq.member-only-group")) {
          return Response.json([
            {
              id: "member-only-group",
              owner_id: "other-owner-999",
              name: "Shared Flat",
              plan_type: "roommates",
              description: "",
              currency: "INR",
              total_budget: 10000,
              start_date: "2026-11-01",
              end_date: null,
              is_demo: false,
              archived_at: null,
              created_at: "2026-11-01T00:00:00Z",
              updated_at: "2026-11-01T00:00:00Z",
            },
          ]);
        }
        if (url.includes("/rest/v1/group_memberships?group_id=eq.member-only-group")) {
          return Response.json([
            {
              id: "mem-owner",
              group_id: "member-only-group",
              user_id: "other-owner-999",
              display_name: "Owner",
              email: null,
              initials: "OW",
              avatar_color: "coral",
              role: "owner",
              paid_amount: 0,
            },
            {
              id: "mem-alex",
              group_id: "member-only-group",
              user_id: "user-real-123",
              display_name: "Alex Kim",
              email: "alex@example.com",
              initials: "AK",
              avatar_color: "sky",
              role: "member",
              paid_amount: 0,
            },
          ]);
        }
        if (
          url.includes("/rest/v1/group_budgets?group_id=eq.member-only-group") ||
          url.includes("/rest/v1/expenses?group_id=eq.member-only-group") ||
          url.includes("/rest/v1/contributions?group_id=eq.member-only-group") ||
          url.includes("/rest/v1/settlements?group_id=eq.member-only-group")
        ) {
          return Response.json([]);
        }
        if (url.endsWith("/rest/v1/groups") && init?.method === "POST") {
          const payload = JSON.parse(String(init.body ?? "{}"));
          insertedOwnerId = payload.owner_id;
          return Response.json([{ ...payload, created_at: "2026-11-11T00:00:00Z", updated_at: "2026-11-11T00:00:00Z" }]);
        }
        if (url.endsWith("/rest/v1/group_memberships") && init?.method === "POST") {
          return Response.json(JSON.parse(String(init.body ?? "[]")));
        }
        if (url.endsWith("/rest/v1/group_budgets") && init?.method === "POST") {
          return Response.json(JSON.parse(String(init.body ?? "[]")));
        }
        if (url.includes("/rest/v1/groups?id=eq.") && init?.method === "GET") {
          return Response.json([]);
        }
        if (url.includes("/rest/v1/security_audit_events")) {
          return new Response(null, { status: 201 });
        }
        return Response.json([]);
      }),
    );

    const authHeaders = {
      "content-type": "application/json",
      cookie: "sm_access_token=valid-user-jwt; sm_session_id=sess_123",
    };

    // 1. Accessing a group where user is not a member returns 403
    const forbiddenRes = await groupPatch(
      new Request("http://localhost:3000/api/groups/foreign-group", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ action: "archive" }),
      }),
      { params: Promise.resolve({ groupId: "foreign-group" }) },
    );
    expect(forbiddenRes.status).toBe(403);

    // 2. Non-organizer member cannot archive a group
    const memberArchiveRes = await groupPatch(
      new Request("http://localhost:3000/api/groups/member-only-group", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ action: "archive" }),
      }),
      { params: Promise.resolve({ groupId: "member-only-group" }) },
    );
    expect(memberArchiveRes.status).toBe(403);
    expect((await memberArchiveRes.json()).error).toContain("organizer or owner");

    // 3. Creating a group ignores spoofed ownerId/userId from client body
    const createRes = await groupsPost(
      new Request("http://localhost:3000/api/groups", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "New Project",
          planType: "project",
          currency: "USD",
          totalBudget: 500,
          startDate: "2026-11-11",
          ownerId: "spoofed-attacker-id",
          userId: "spoofed-attacker-id",
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    expect(insertedOwnerId).toBe("user-real-123");
  });

  it("blocks client creation, editing, or deletion of security audit records", async () => {
    setTestSupabaseEnv();
    const warnings: Record<string, unknown>[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) {
          return Response.json({
            id: "user-123",
            email: "alex@example.com",
            user_metadata: { full_name: "Alex Kim" },
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
          warnings.push(JSON.parse(String(init?.body ?? "{}")));
          return new Response(null, { status: 201 });
        }
        return Response.json([]);
      }),
    );

    const headers = {
      "content-type": "application/json",
      cookie: "sm_access_token=valid-jwt; sm_session_id=sess_123",
    };

    const postRes = await securityPost(
      new Request("http://localhost:3000/api/security/events", {
        method: "POST",
        headers,
        body: JSON.stringify({ eventName: "Fake" }),
      }),
    );
    const patchRes = await securityPatch(
      new Request("http://localhost:3000/api/security/events", { method: "PATCH", headers }),
    );
    const deleteRes = await securityDelete(
      new Request("http://localhost:3000/api/security/events", { method: "DELETE", headers }),
    );

    expect(postRes.status).toBe(403);
    expect(patchRes.status).toBe(403);
    expect(deleteRes.status).toBe(403);
    expect(warnings.length).toBe(3);
    expect(warnings.every((w) => w.event_type === "security.warning")).toBe(true);
  });
});
