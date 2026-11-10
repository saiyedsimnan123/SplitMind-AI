import { NextResponse } from "next/server";
import { findPaymentByOrder, paypalRequest, persistPayment } from "@/lib/paypal";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderId?: unknown };
    if (typeof body.orderId !== "string" || !/^[A-Z0-9-]{5,64}$/i.test(body.orderId)) {
      return NextResponse.json({ error: "A valid PayPal order ID is required." }, { status: 400 });
    }
    const record = await findPaymentByOrder(body.orderId);
    if (!record) return NextResponse.json({ error: "This order is not in the SplitMind payment ledger; it has not been marked paid." }, { status: 404 });
    if (record.status === "COMPLETED") return NextResponse.json({ status: record.status, amount: record.amount, currency: record.currency, captureId: record.capture_id });

    const capture = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(body.orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `${record.idempotency_key.slice(0, 30)}-capture`, prefer: "return=representation" },
      body: "{}",
    }) as { id: string; status: string; purchase_units?: { payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[] };
    const captured = capture.purchase_units?.[0]?.payments?.captures?.[0];
    if (capture.status !== "COMPLETED" || captured?.status !== "COMPLETED" ||
        captured.amount.value !== record.amount || captured.amount.currency_code !== record.currency) {
      const status = captured?.status ?? capture.status ?? "UNVERIFIED";
      await persistPayment({ ...record, status, capture_id: captured?.id ?? null });
      return NextResponse.json({ error: "PayPal capture was not verified as completed for the expected amount and currency.", status }, { status: 409 });
    }
    await persistPayment({ ...record, status: "COMPLETED", capture_id: captured.id });
    return NextResponse.json({ status: "COMPLETED", amount: record.amount, currency: record.currency, captureId: captured.id });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "PayPal capture verification failed." }, { status: 503 });
  }
}
