import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { AuthVisualPreview } from "@/components/auth/AuthVisualPreview";
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
  const headerAction =
    activeRoute === "login"
      ? { href: "/signup", label: "Create account" }
      : { href: "/login", label: "Sign in" };

  return (
    <div className="auth-viewport">
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow-blue" aria-hidden="true" />
      <div className="auth-glow auth-glow-violet" aria-hidden="true" />

      <header className="auth-top-bar">
        <Link href="/login" className="brand brand-light">
          <BrandMark size={30} />
          <span className="brand-name brand-name-light">
            SplitMind<span> AI</span>
          </span>
        </Link>

        <Link href={headerAction.href} className="auth-top-action">
          <span>{headerAction.label}</span>
          <ArrowRight size={14} />
        </Link>
      </header>

      <main className="auth-center-stage">
        <div className="auth-focused-column">
          <div className="auth-page-hero">
            <span className="auth-kicker-pill">{kicker}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <section className="auth-surface-card" aria-label={title}>
            {!authConfigured && (
              <div className="auth-config-alert" role="status">
                <ShieldAlert size={18} />
                <div>
                  <strong>Supabase Auth configuration required</strong>
                  <p>
                    Add <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and{" "}
                    <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code> and run the
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

          <AuthVisualPreview />
        </div>
      </main>
    </div>
  );
}
