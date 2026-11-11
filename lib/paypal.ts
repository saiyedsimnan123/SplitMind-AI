import { createHash } from "node:crypto";

const TABLE = "splitmind_payments";
type PayPalOrder = { id: string; status: string; links?: { href: string; rel: string }[] };

function config() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("PayPal Sandbox is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the server environment.");
  if (process.env.PAYPAL_ENV && process.env.PAYPAL_ENV !== "sandbox") throw new Error("Only PayPal Sandbox is enabled in this demo.");
  return { clientId, secret, api: "https://api-m.sandbox.paypal.com" };
}

function databaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Payment status persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and apply supabase/schema.sql.");
  return { url: url.replace(/\/+$/, ""), key };
}

export async function paypalRequest(path: string, init: RequestInit = {}) {
  const { clientId, secret, api } = config();
  const tokenResponse = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(12000),
  });
  if (!tokenResponse.ok) throw new Error(`PayPal authentication failed (${tokenResponse.status}). Check the Sandbox app credentials.`);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error("PayPal did not return an access token.");
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({})) as PayPalOrder & { message?: string; details?: { description?: string }[] };
  if (!response.ok) throw new Error(data.details?.[0]?.description ?? data.message ?? `PayPal request failed (${response.status}).`);
  return data;
}

export function approvalUrl(order: PayPalOrder) {
  const link = order.links?.find((item) => item.rel === "approve" || item.rel === "payer-action");
  if (!link) throw new Error("PayPal did not return a valid approval URL.");
  const url = new URL(link.href);
  if (url.protocol !== "https:" || !(url.hostname === "paypal.com" || url.hostname.endsWith(".paypal.com"))) {
    throw new Error("PayPal returned an untrusted approval URL.");
  }
  return link.href;
}

function dbHeaders(extra: Record<string, string> = {}) {
  const { key } = databaseConfig();
  return { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...extra };
}

export async function findPaymentByKey(key: string) {
  const { url } = databaseConfig();
  const response = await fetch(`${url}/rest/v1/${TABLE}?idempotency_key=eq.${encodeURIComponent(key)}&select=*`, {
    headers: dbHeaders(), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Could not check the payment record (${response.status}).`);
  return (await response.json() as PaymentRecord[])[0] ?? null;
}

export async function findPaymentByOrder(orderId: string) {
  const { url } = databaseConfig();
  const response = await fetch(`${url}/rest/v1/${TABLE}?order_id=eq.${encodeURIComponent(orderId)}&select=*`, {
    headers: dbHeaders(), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Could not verify the payment record (${response.status}).`);
  return (await response.json() as PaymentRecord[])[0] ?? null;
}

export type PaymentRecord = {
  idempotency_key: string;
  order_id: string;
  amount: string;
  currency: string;
  status: string;
  capture_id: string | null;
  user_id?: string | null;
  group_id?: string | null;
};

export async function persistPayment(record: PaymentRecord) {
  const { url } = databaseConfig();
  const response = await fetch(`${url}/rest/v1/${TABLE}?on_conflict=idempotency_key`, {
    method: "POST",
    headers: dbHeaders({ prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(record), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Could not persist the PayPal status (${response.status}).`);
}

export function paymentKey(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
