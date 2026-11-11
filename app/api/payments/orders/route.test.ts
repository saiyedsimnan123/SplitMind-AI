import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/payments/orders/route";

const originalEnv = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  if (originalEnv.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalEnv.supabaseUrl;
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
});
