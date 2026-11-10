import { NextResponse } from "next/server";
import { approvalUrl, findPaymentByKey, paymentKey, paypalRequest, persistPayment } from "@/lib/paypal";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { amount?: unknown; idempotencyKey?: unknown };
    if (typeof body.amount !== "string" || !/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(body.amount)) {
      return NextResponse.json({ error: "Enter a valid Sandbox payment between $0.01 and $9,999.99 USD." }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (amount < 0.01 || amount > 9999.99) return NextResponse.json({ error: "Payment must be between $0.01 and $9,999.99 USD." }, { status: 400 });
    if (typeof body.idempotencyKey !== "string" || !/^[a-f0-9-]{36}$/i.test(body.idempotencyKey)) {
      return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 });
    }
    const key = paymentKey(body.idempotencyKey);
    const existing = await findPaymentByKey(key);
    if (existing) {
      const approval = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(existing.order_id)}`) as { id: string; status: string; links?: { href: string; rel: string }[] };
      return NextResponse.json({ orderId: existing.order_id, approvalUrl: approvalUrl(approval), status: existing.status });
    }

    const appUrl = process.env.APP_URL;
    const origin = appUrl ? new URL(appUrl).origin : new URL(request.url).origin;
    const order = await paypalRequest("/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": key.slice(0, 38), prefer: "return=representation" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: key.slice(0, 24), amount: { currency_code: "USD", value: amount.toFixed(2) }, description: "SplitMind group expense contribution (Sandbox)" }],
        application_context: { brand_name: "SplitMind AI", user_action: "PAY_NOW", return_url: `${origin}/?paypal_return=1`, cancel_url: `${origin}/?paypal_cancelled=1` },
      }),
    }) as { id: string; status: string; links?: { href: string; rel: string }[] };
    if (!order.id) throw new Error("PayPal did not return an order ID.");
    await persistPayment({ idempotency_key: key, order_id: order.id, amount: amount.toFixed(2), currency: "USD", status: order.status, capture_id: null });
    return NextResponse.json({ orderId: order.id, approvalUrl: approvalUrl(order), status: order.status });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create a PayPal Sandbox order." }, { status: 503 });
  }
}
