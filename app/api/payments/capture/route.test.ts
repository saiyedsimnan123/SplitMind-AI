import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/payments/capture/route";

describe("PayPal capture verification", () => {
  it("rejects missing or malformed order IDs without confirming a payment", async () => {
    const response = await POST(new Request("http://localhost/api/payments/capture", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: "x" }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/order ID/);
  });

  it("never confirms an order that is absent from the payment ledger", async () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const response = await POST(new Request("http://localhost/api/payments/capture", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: "ORDER-12345" }),
      }));
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("Payment status persistence is not configured");
    } finally {
      if (savedUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = savedUrl;
      if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });
});
