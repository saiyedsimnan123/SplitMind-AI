import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as capturePost } from "@/app/api/payments/capture/route";
import { POST } from "@/app/api/payments/orders/route";

const originalEnv = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEnv.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalEnv.supabaseUrl;
  if (originalEnv.supabaseAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalEnv.supabaseAnonKey;
  if (originalEnv.supabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.supabaseKey;
});

describe("PayPal order creation", () => {
  it("rejects malformed or out-of-range amounts before contacting payment providers", async () => {
    const response = await POST(new Request("http://localhost/api/payments/orders", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: "0.001", idempotencyKey: "a0b1c2d3-e4f5-4678-9012-123456789012" }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/valid Sandbox payment/);
  });

  it("requires payment status persistence instead of creating an untracked order", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await POST(new Request("http://localhost/api/payments/orders", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: "10.00", idempotencyKey: "a0b1c2d3-e4f5-4678-9012-123456789012" }),
    }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Payment status persistence is not configured");
  });

  it("blocks demo anonymous sessions from creating or capturing real PayPal orders (403)", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const externalCalls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("paypal.com")) externalCalls.push(url);
        if (url.includes("/auth/v1/user")) {
          return Response.json({
            id: "demo-user-pay",
            is_anonymous: true,
            email: "",
            app_metadata: { provider: "anonymous" },
            user_metadata: { full_name: "Demo Explorer", is_demo: true },
          });
        }
        if (url.includes("/rest/v1/profiles")) {
          return Response.json([
            {
              id: "demo-user-pay",
              email: "",
              full_name: "Demo Explorer",
              initials: "DM",
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

    const createRes = await POST(
      new Request("http://localhost/api/payments/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=demo-jwt; sm_session_id=demo-sess",
        },
        body: JSON.stringify({
          amount: "25.00",
          idempotencyKey: "a0b1c2d3-e4f5-4678-9012-123456789012",
        }),
      }),
    );
    expect(createRes.status).toBe(403);
    expect((await createRes.json()).error).toMatch(/Real PayPal transactions are disabled in Demo Mode/i);

    const captureRes = await capturePost(
      new Request("http://localhost/api/payments/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "sm_access_token=demo-jwt; sm_session_id=demo-sess",
        },
        body: JSON.stringify({ orderId: "PAYPAL_ORDER_123" }),
      }),
    );
    expect(captureRes.status).toBe(403);
    expect((await captureRes.json()).error).toMatch(/Real PayPal captures are disabled in Demo Mode/i);
    expect(externalCalls.length).toBe(0);
  });
});
