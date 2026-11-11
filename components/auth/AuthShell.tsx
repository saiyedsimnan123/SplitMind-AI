import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/ui";

export function AuthShell({
  kicker,
  title,
  subtitle,
  authConfigured,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  authConfigured: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-name">
            splitmind<span>.</span>
          </span>
        </Link>

        {!authConfigured && (
          <Link href="/" className="button button-outline">
            <ArrowLeft size={14} /> Open local preview
          </Link>
        )}
      </header>

      <main className="auth-main">
        <section className="panel auth-card">
          <div className="section-kicker">{kicker}</div>
          <h1>{title}</h1>
          <p className="muted-copy">{subtitle}</p>

          {!authConfigured && (
            <div className="receipt-missing-box" role="status" style={{ marginBottom: 16 }}>
              <ShieldAlert size={18} />
              <div>
                <strong>Supabase Auth is not configured in this environment</strong>
                <p>
                  Set <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> (plus{" "}
                  <code>SUPABASE_SERVICE_ROLE_KEY</code>) in <code>.env.local</code> and apply the SQL
                  migrations to enable live authentication. Fake login simulation is disabled.
                </p>
              </div>
            </div>
          )}

          {children}

          <div className="safety-note" style={{ marginTop: 18 }}>
            <LockKeyhole size={14} />
            <span>
              Sessions are stored in server-set <strong>HttpOnly</strong> cookies—never in browser{" "}
              <code>localStorage</code>.
            </span>
          </div>

          <div className="auth-footer">{footer}</div>
        </section>

        <aside className="auth-aside">
          <div className="upgrade-pill">
            <ShieldCheck size={12} /> Server-verified RLS
          </div>
          <h2>One calm ledger for every shared plan.</h2>
          <p>
            Trips, roommate apartments, events, and group budgets stay strictly isolated per group with
            immutable audit history.
          </p>
          <ul className="auth-highlights">
            <li>Isolated group ledgers, currencies, and settlement plans</li>
            <li>Server-side Supabase Auth with automatic token verification</li>
            <li>Row Level Security policies across profiles, groups, and expenses</li>
            <li>Dedicated Security &amp; Activity log under Settings</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
