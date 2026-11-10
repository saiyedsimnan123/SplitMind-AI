# SplitMind AI

**One Group. One Smart Money Mind.** SplitMind is a group-expense coordination demo built around the Goa Trip 2026 scenario: eight friends, three days, and a ₹40,000 shared plan.

## What works in this demo

- Responsive dashboard with an editable category budget, group contributions, and current spend.
- SmartSplit equal-share balances and a minimum-transfer settlement suggestion.
- Expense submissions with optional receipt images/PDFs and explicit **unverified** status until a person opens the evidence and confirms their review. OCR and automated duplicate/discrepancy detection are not implemented.
- MoneyTwin simulations for unexpected costs and member cancellations. Scenarios do not modify an agreed budget.
- Group financial agent that calls the real local calculation functions. Without `GEMINI_API_KEY`, answers are explicitly attributed to the deterministic engine. With Gemini configured, it may explain deterministic calculation results but does not calculate financial amounts itself.
- Server-side PayPal Sandbox order creation and capture, with idempotent order requests and a Supabase payment ledger. No payment is considered complete based on a browser redirect; the server verifies the PayPal capture and exact amount/currency.

The demo workspace's group data and small receipt attachments are saved in **the current browser's local storage**. They are not shared with other members. Budget edits create local proposals and do not change the agreed budget; this demo has no shared group-approval flow. PayPal payment status is persisted separately in Supabase when configured. SplitMind never holds, escrows, or transfers group funds; the payer authorizes a payment through PayPal, which processes it directly.

## Run locally

Requirements: Node.js 20.9 or later and npm. The configured test runner requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard and deterministic agent work without external AI or payment credentials.

## Optional Gemini agent explanations

Set `GEMINI_API_KEY` in `.env.local`; optionally set `GEMINI_MODEL` (defaults to `gemini-2.0-flash`). The server computes all financial results before requesting an explanation from Gemini. If Gemini is configured but unavailable, the request returns an error rather than claiming a deterministic response came from Gemini or silently switching modes. No API key is exposed in browser code.

## PayPal Sandbox

PayPal checkout is **USD Sandbox only**; demo group budgets remain in INR. The amount sent to PayPal is not an implicit INR/USD conversion and is not automatically reconciled to a member's INR share.

1. Create a PayPal developer account and a Sandbox REST app, then copy its Sandbox client ID and secret.
2. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL editor.
3. Configure `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or your deployment's server environment.
4. Set `APP_URL` to the canonical deployment origin (for example `https://your-app.vercel.app`) when deployed, so the approval return URL is predictable.
5. In PayPal's Sandbox, use a test buyer account for checkout. No real payment credentials are needed.

`SUPABASE_SERVICE_ROLE_KEY` and `PAYPAL_CLIENT_SECRET` are server-only. Never prefix them with `NEXT_PUBLIC_` or commit them. The service-role key bypasses Row Level Security and is used only by the server API routes; no public client policies are needed for the payment table. A configured PayPal order is recorded as pending and only becomes `COMPLETED` after server-side capture verification. Cancellation or an incomplete capture is not reported as paid.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | No | Optional server-side Gemini explanation |
| `GEMINI_MODEL` | No | Gemini model name |
| `PAYPAL_ENV` | For PayPal | `sandbox` only |
| `PAYPAL_CLIENT_ID` | For PayPal | Sandbox REST app client ID |
| `PAYPAL_CLIENT_SECRET` | For PayPal | Sandbox REST app secret; server only |
| `SUPABASE_URL` | For PayPal | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For PayPal | Server-only Supabase service role |
| `APP_URL` | Recommended in production | Canonical app URL for PayPal return links |

## Validate

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Architecture and limitations

- Next.js App Router, React, strict TypeScript; suitable for Vercel deployment.
- Pure calculation functions in `lib/finance.ts`, called by both the UI and the financial agent.
- Next.js route handlers validate requests and keep all external service credentials on the server.
- `supabase/schema.sql` provides a server-side idempotent payment ledger. No general group database, authentication, or multi-user synchronization is configured in this demo.
- PayPal operations are not enabled unless Sandbox credentials and Supabase persistence are both set up.
- Submitted receipts and a recent local action history are stored per browser and are not an audit-grade shared record. OCR and automated receipt checks are not implemented.

This is a demo—not financial, tax, investment, or payment-processor advice.
