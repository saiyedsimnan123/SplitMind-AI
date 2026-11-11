import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/ui";

export function AuthShell({
  activeRoute,
  kicker,
  title,
  subtitle,
  authConfigured,
  children,
  footer,
}: {
  activeRoute: "login" | "signup" | "forgot" | "reset";
  kicker: string;
  title: string;
  subtitle: string;
  authConfigured: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="auth-split-layout">
      <section className="auth-brand-stage" aria-label="SplitMind AI platform overview">
        <div className="auth-orb auth-orb-1" aria-hidden="true" />
        <div className="auth-orb auth-orb-2" aria-hidden="true" />
        <div className="auth-grid-overlay" aria-hidden="true" />

        <div className="auth-stage-inner">
          <div className="auth-stage-top">
            <Link href="/login" className="brand brand-light">
              <BrandMark />
              <span className="brand-name brand-name-light">
                SplitMind<span> AI</span>
              </span>
            </Link>
            <span className="auth-stage-pill">
              <Sparkles size={12} /> AI GROUP FINANCE PLATFORM
            </span>
          </div>

          <div className="auth-stage-copy">
            <p className="auth-tagline">One Group. One Smart Money Mind.</p>
            <h2>Coordinate shared budgets, receipts, and settlements with total clarity.</h2>
            <p className="auth-promo">
              Run isolated group ledgers for trips, roommates, events, and projects—powered by
              deterministic SmartSplit math, Proof Engine receipt review, MoneyTwin simulations, and
              row-level database security.
            </p>
          </div>

          <div className="auth-illustration-frame">
            <Image
              src="/images/auth-fintech-hero.svg"
              alt="SplitMind AI dashboard illustration showing shared group budgets, SmartSplit settlement transfers, and Proof Engine verification"
              width={640}
              height={440}
              priority
              unoptimized
              className="auth-hero-illustration"
            />
          </div>

          <div className="auth-engine-strip" aria-label="Platform intelligence engines">
            <span>SmartSplit Engine</span>
            <span>Proof Engine</span>
            <span>MoneyTwin Engine</span>
            <span>IntentPay</span>
            <span>AI Financial Agent</span>
          </div>
        </div>
      </section>

      <main className="auth-form-stage">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <BrandMark />
            <span className="brand-name">
              SplitMind<span> AI</span>
            </span>
          </div>

          <nav className="auth-mode-tabs" aria-label="Authentication navigation">
            <Link
              href="/login"
              className={`auth-mode-tab ${activeRoute === "login" ? "active" : ""}`}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={`auth-mode-tab ${activeRoute === "signup" ? "active" : ""}`}
            >
              Create account
            </Link>
            <Link
              href="/forgot-password"
              className={`auth-mode-tab ${activeRoute === "forgot" || activeRoute === "reset" ? "active" : ""}`}
            >
              Password recovery
            </Link>
          </nav>

          <section className="auth-form-card">
            <div className="section-kicker">{kicker}</div>
            <h1>{title}</h1>
            <p className="muted-copy">{subtitle}</p>

            {!authConfigured && (
              <div className="auth-config-alert" role="status">
                <ShieldAlert size={18} />
                <div>
                  <strong>Supabase Auth configuration required</strong>
                  <p>
                    Set <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and{" "}
                    <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code> and apply the SQL
                    migrations to sign in. Client-side login bypasses are disabled.
                  </p>
                </div>
              </div>
            )}

            {children}

            <div className="auth-security-foot">
              <div className="auth-security-badge">
                <LockKeyhole size={13} />
                <span>HttpOnly server cookies · Zero token storage in localStorage</span>
              </div>
              <div className="auth-security-badge">
                <ShieldCheck size={13} />
                <span>Supabase Row Level Security &amp; immutable audit logging</span>
              </div>
            </div>

            <div className="auth-footer">{footer}</div>
          </section>
        </div>
      </main>
    </div>
  );
}
