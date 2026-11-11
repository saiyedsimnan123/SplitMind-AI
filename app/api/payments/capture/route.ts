import { NextResponse } from "next/server";
import { findPaymentByOrder, paypalRequest, persistPayment } from "@/lib/paypal";
import { applySessionCookies, getRequestSession } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";

export async function POST(request: Request) {
  try {
    let userId: string | null = null;
    let userLabel = "Workspace user";
    let refreshedSession: Awaited<ReturnType<typeof getRequestSession>> = null;

    if (isSupabaseAuthConfigured()) {
      const session = await getRequestSession(request);
      if (!session) {
        return NextResponse.json({ error: "Sign in to verify PayPal captures." }, { status: 401 });
      }
      refreshedSession = session;
      userId = session.user.id;
      userLabel = session.user.user_metadata?.full_name || session.user.email;
    }

    const body = (await request.json()) as { orderId?: unknown };
    if (typeof body.orderId !== "string" || !/^[A-Z0-9-]{5,64}$/i.test(body.orderId)) {
      return NextResponse.json({ error: "A valid PayPal order ID is required." }, { status: 400 });
    }
    const record = await findPaymentByOrder(body.orderId);
    if (!record) {
      return NextResponse.json(
        { error: "This order is not in the SplitMind payment ledger; it has not been marked paid." },
        { status: 404 },
      );
    }
    if (userId && record.user_id && record.user_id !== userId) {
      await recordServerAuditEvent({
        category: "security",
        eventType: "security.warning",
        eventName: "Unauthorized payment capture attempt",
        status: "warning",
        actorUserId: userId,
        actorLabel: userLabel,
        groupId: record.group_id ?? null,
        description: `Blocked attempt to capture PayPal order ${record.order_id} owned by another account.`,
      });
      return NextResponse.json(
        { error: "You do not have permission to capture this PayPal order." },
        { status: 403 },
      );
    }
    if (record.status === "COMPLETED") {
      const res = NextResponse.json({
        status: record.status,
        amount: record.amount,
        currency: record.currency,
        captureId: record.capture_id,
      });
      if (refreshedSession?.refreshed) applySessionCookies(res, refreshedSession, request);
      return res;
    }

    const capture = (await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(body.orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `${record.idempotency_key.slice(0, 30)}-capture`, prefer: "return=representation" },
      body: "{}",
    })) as {
      id: string;
      status: string;
      purchase_units?: {
        payments?: {
          captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[];
        };
      }[];
    };
    const captured = capture.purchase_units?.[0]?.payments?.captures?.[0];
    if (
      capture.status !== "COMPLETED" ||
      captured?.status !== "COMPLETED" ||
      captured.amount.value !== record.amount ||
      captured.amount.currency_code !== record.currency
    ) {
      const status = captured?.status ?? capture.status ?? "UNVERIFIED";
      await persistPayment({ ...record, status, capture_id: captured?.id ?? null });
      await recordServerAuditEvent({
        category: "financial",
        eventType: "payment.capture_failed",
        eventName: "PayPal capture verification failed",
        status: "failure",
        actorUserId: userId,
        actorLabel: userLabel,
        groupId: record.group_id ?? null,
        description: `PayPal order ${record.order_id} capture returned status ${status} and was not marked completed.`,
        metadata: { orderId: record.order_id, status },
      });
      return NextResponse.json(
        { error: "PayPal capture was not verified as completed for the expected amount and currency.", status },
        { status: 409 },
      );
    }

    await persistPayment({ ...record, status: "COMPLETED", capture_id: captured.id });
    await recordServerAuditEvent({
      category: "financial",
      eventType: "payment.captured",
      eventName: "PayPal Sandbox payment verified",
      status: "success",
      actorUserId: userId,
      actorLabel: userLabel,
      groupId: record.group_id ?? null,
      description: `Verified PayPal capture ${captured.id} for ${record.amount} ${record.currency}.`,
      metadata: { orderId: record.order_id, captureId: captured.id, amount: record.amount, currency: record.currency },
    });

    const res = NextResponse.json({
      status: "COMPLETED",
      amount: record.amount,
      currency: record.currency,
      captureId: captured.id,
    });
    if (refreshedSession?.refreshed) applySessionCookies(res, refreshedSession, request);
    return res;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PayPal capture verification failed." },
      { status: 503 },
    );
  }
}
