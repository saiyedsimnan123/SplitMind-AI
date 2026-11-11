# SplitMind AI

**One Group. One Smart Money Mind.** SplitMind AI is a multi-group shared finance workspace for trips, roommates, events, and projects, featuring isolated group ledgers, deterministic SmartSplit settlements, explicit human receipt verification, Supabase Auth & Row Level Security (RLS), immutable security/audit trails, and server-verified PayPal Sandbox checkout.

## Features

- **Multi-Group Workspaces**: Create independent groups for Trips & vacations, Roommates & shared living, Events & parties, Projects, or other shared plans—each with its own currency (`INR`, `USD`, `EUR`, `GBP`), total budget, date range, organizer/owner, members, expenses, contributions, and settlements. **Goa Trip 2026** is preserved as the initial demo group.
- **Interactive Budgets & SmartSplit**: Edit category budgets, apply updates with confirmation to recalculate remaining balances, run non-destructive MoneyTwin what-if simulations, record member contributions & settlement transfers, and search/filter groups and expenses.
- **Human Receipt Verification**: Expense submissions remain **Unverified** until a person opens the attached image/PDF receipt and explicitly confirms review.
- **Group Financial Agent**: Calls deterministic calculation functions in `lib/finance.ts` scoped to the active group and currency. Optionally explains verified calculations using Gemini when `GEMINI_API_KEY` is configured.
- **Multi-Method Supabase Auth & Protected Routes**: Server-side authentication (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/api/auth/*`) supporting **Email OTP & Password**, **Phone OTP (Supabase + Twilio SMS, defaulting to India `+91`)**, **Google OAuth (PKCE)**, and **Explore Demo →** using `HttpOnly`, `SameSite=Lax` cookies—never storing passwords or tokens in `localStorage`.
- **Isolated Demo Mode (`Explore Demo →`)**: Launches an ephemeral Supabase Anonymous session (`DEMO`) seeded with the 8-friend, 3-day **Goa Trip 2026** group, isolated via RLS and blocked from credential edits or real PayPal API calls.
- **Settings → Security & Activity**: Dedicated audit trail separating Authentication/Session events from Group/Financial ledger events, with search and filters by event type, group, status, and date, plus active session/device overview and session revocation controls (`local`, `others`, `global`).
- **PayPal Sandbox Checkout**: Server-side order creation and capture verification with client idempotency protection and Supabase ledger persistence (`public.splitmind_payments`).

## Authentication-First Access

- **Unauthenticated visitors**: Middleware and server checks redirect `/` and `/dashboard` (and block `/api/groups/*`, `/api/profile`, `/api/security/*`) to `/login`. Authentication is always the entry point—there is no unauthenticated dashboard bypass or `localStorage` login simulation.
- **Without Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)**: The `/login`, `/signup`, `/forgot-password`, and `/reset-password` pages honestly report that Supabase Auth must be configured in `.env.local` before signing in.
- **With Supabase credentials configured**: Full Supabase Auth sign-up, sign-in (`HttpOnly` cookies with Remember-me duration support), password recovery, session refresh/revocation, PostgreSQL Row Level Security (`auth.uid()`), and immutable `security_audit_events` are active.

## Run locally

Requirements: Node.js 20.9 or later and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database & Migration Setup (Supabase)

1. Create a Supabase project.
2. Apply the SQL migrations in order using the Supabase CLI or SQL Editor:
   - [`supabase/migrations/0001_initial_payments.sql`](./supabase/migrations/0001_initial_payments.sql)
   - [`supabase/migrations/0002_multi_group_auth_and_audit.sql`](./supabase/migrations/0002_multi_group_auth_and_audit.sql)
   - [`supabase/migrations/0003_multi_method_auth_profiles.sql`](./supabase/migrations/0003_multi_method_auth_profiles.sql)
   *(Alternatively, [`supabase/schema.sql`](./supabase/schema.sql) contains the consolidated schema.)*
3. In **Supabase Authentication → URL Configuration**, add your redirect URLs (for Google OAuth PKCE callback, password recovery, and confirmation flows):
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3000/api/auth/confirm`
   - `http://localhost:3000/reset-password`
   - `https://<your-domain>/api/auth/callback`
   - `https://<your-domain>/api/auth/confirm`
   - `https://<your-domain>/reset-password`
4. Configure **6-Digit Email OTP (Signup & Passwordless Login)** in Supabase Dashboard:
   - Go to **Authentication → Providers → Email** and ensure **Enable Email provider** and **Confirm email** are turned **ON**.
   - Go to **Authentication → Email Templates → Confirm signup** and update the body to display the 6-digit OTP token `{{ .Token }}` instead of relying on `{{ .ConfirmationURL }}` (for example: `Your SplitMind AI verification code is: <strong>{{ .Token }}</strong>`).
   - Go to **Authentication → Email Templates → Magic Link** and display `{{ .Token }}` as well so passwordless 6-digit **Email OTP login** delivers a numeric OTP code cleanly.
   - Keep **Reset Password** using `{{ .ConfirmationURL }}` so `/forgot-password` and `/reset-password` continue using `/api/auth/confirm?type=recovery`.
5. Configure **Phone OTP (Supabase + Twilio)**:
   - **In Twilio Console**:
     1. Create a **Messaging Service** under **Messaging → Services** and assign an SMS-capable Twilio number / Sender ID to its **Sender Pool**.
     2. Under **Messaging → Settings → Geo Permissions**, enable **India (+91)** and any other target countries.
     3. **India (`+91`) SMS delivery requirements**: Carriers in India enforce **TRAI DLT (Distributed Ledger Technology)** regulations for A2P SMS. Register your Entity ID, Header (Sender ID), and OTP SMS content template (matching Supabase's OTP message text, e.g., `Your verification code is {{ .Code }}`) on an Indian telecom DLT portal and link them in Twilio / your Twilio Messaging Service before sending production OTP SMS to Indian mobile numbers.
     4. Copy your **Twilio Account SID**, **Twilio Auth Token**, and **Twilio Messaging Service SID (`MG...`)**.
   - **In Supabase Dashboard**:
     1. Go to **Authentication → Providers → Phone** and toggle **Enable Phone provider** **ON**.
     2. Select **Twilio** as the SMS provider and paste your **Twilio Account SID**, **Twilio Auth Token**, and **Twilio Message Service SID** directly in Supabase Dashboard (never commit them into this repository).
     3. Keep **Enable phone confirmations** **ON** and save.
6. Configure **Google OAuth (Supabase Auth + Google Cloud)**:
   - **In Google Cloud Console**:
     1. Open **APIs & Services → OAuth consent screen**, configure your External/Internal app name (**SplitMind AI**), support email, and authorized domains.
     2. Open **APIs & Services → Credentials → Create Credentials → OAuth client ID** and choose **Web application**.
     3. Under **Authorized redirect URIs**, add Supabase's callback URL:
        `https://<your-project-ref>.supabase.co/auth/v1/callback`
     4. Copy the generated **Google Client ID** and **Google Client Secret**.
   - **In Supabase Dashboard**:
     1. Go to **Authentication → Providers → Google** and toggle **Enable Sign in with Google** **ON**.
     2. Paste your **Client ID** and **Client Secret** directly in Supabase Dashboard and save.
     3. Confirm `http://localhost:3000/api/auth/callback` (and your production URL) is listed under **Authentication → URL Configuration → Redirect URLs**.
7. Enable **Anonymous Sign-Ins** for the **Explore Demo →** flow:
   - Go to **Authentication → Providers** (or **Authentication → Settings**) and enable **Allow anonymous sign-ins**.
   - Each demo visitor receives a separate temporary `auth.uid()` (`is_anonymous: true`), isolated by PostgreSQL RLS so demo changes cannot affect real user workspaces.
8. Configure `.env.local` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_URL`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | For Auth, DB & PayPal | Supabase project URL |
| `SUPABASE_ANON_KEY` | For Auth & RLS queries | Public anon key used server-side with user JWTs |
| `SUPABASE_SERVICE_ROLE_KEY` | For Audit Logs & PayPal | Server-only service role key (never expose to browser) |
| `APP_URL` | Recommended | Canonical app origin for auth email redirects & PayPal return URLs |
| `PAYPAL_ENV` | For PayPal | `sandbox` only |
| `PAYPAL_CLIENT_ID` | For PayPal | Sandbox REST app client ID |
| `PAYPAL_CLIENT_SECRET` | For PayPal | Sandbox REST app secret (server-only) |
| `GEMINI_API_KEY` | No | Optional server-side Gemini explanation |
| `GEMINI_MODEL` | No | Gemini model name (defaults to `gemini-2.0-flash`) |

## Security Model & RLS Highlights

- **No browser token storage**: Supabase `access_token` and `refresh_token` stay inside server-set `HttpOnly` cookies.
- **No service-role key exposure**: `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_` and is only used in server route handlers (`splitmind_payments` and append-only `security_audit_events`).
- **Row Level Security (RLS)**: Enabled across `profiles`, `groups`, `group_memberships`, `group_budgets`, `expenses`, `contributions`, `settlements`, `security_audit_events`, and `splitmind_payments`.
- **Immutable Audit Ledger**: `security_audit_events` blocks `INSERT`/`UPDATE`/`DELETE` from `anon` and `authenticated` roles via PostgreSQL privileges, RLS, triggers, and API route checks (`403`), and redacts passwords, bearer tokens, and secrets before writing.
- **Server-derived Identity**: Route handlers derive `user.id` exclusively from verified Supabase Auth sessions (`auth.uid()`), never from client-supplied `userId` or `ownerId` fields.

## Validate

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

This is a coordination workspace—not financial, tax, investment, or payment-processor advice.
