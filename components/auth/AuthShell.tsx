import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { BrandMark } from "@/components/ui";

export function AuthShell({
  activeRoute,
  title,
  subtitle,
  authConfigured,
  children,
  footer,
}: {
  activeRoute: "login" | "signup" | "forgot" | "reset";
  title: string;
  subtitle: string;
  authConfigured: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const headerAction =
    activeRoute === "login"
      ? { href: "/signup", label: "Create Account" }
      : { href: "/login", label: "Sign In" };

  return (
    <div className="auth-viewport">
      <div className="auth-bg-grid" aria-hidden="true" />
      <div className="auth-glow auth-glow-blue" aria-hidden="true" />
      <div className="auth-glow auth-glow-violet" aria-hidden="true" />
      <svg
        className="auth-bg-orbits"
        viewBox="0 0 1200 720"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M120 210 C 340 120, 480 280, 600 180 C 720 80, 880 240, 1080 150"
          stroke="url(#bgArcA)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
        <path
          d="M90 540 C 310 470, 460 580, 600 500 C 740 420, 910 540, 1110 460"
          stroke="url(#bgArcB)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
        <circle cx="240" cy="176" r="3" fill="#60A5FA" fillOpacity="0.45" />
        <circle cx="960" cy="182" r="3" fill="#A78BFA" fillOpacity="0.45" />
        <circle cx="210" cy="516" r="3" fill="#2DD4BF" fillOpacity="0.4" />
        <circle cx="980" cy="494" r="3" fill="#60A5FA" fillOpacity="0.4" />
        <defs>
          <linearGradient id="bgArcA" x1="120" y1="180" x2="1080" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
            <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bgArcB" x1="90" y1="500" x2="1110" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <header className="auth-top-bar">
        <Link href="/login" className="auth-brand-link" aria-label="SplitMind AI home">
          <BrandMark size={36} />
          <span className="auth-brand-copy">
            <span className="auth-brand-wordmark">
              SplitMind <span className="auth-brand-ai">AI</span>
            </span>
            <span className="auth-brand-tagline">One Group. One Smart Money Mind.</span>
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
            <div className="auth-hero-mark-row">
              <BrandMark size={42} />
            </div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <section className="auth-surface-card" aria-label={title}>
            <div className="auth-card-accent" aria-hidden="true" />

            {!authConfigured && (
              <div className="auth-config-alert" role="status">
                <ShieldAlert size={18} />
                <div>
                  <strong>Supabase Auth configuration required</strong>
                  <p>
                    Add <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and{" "}
                    <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code> to sign in or
                    create an account.
                  </p>
                </div>
              </div>
            )}

            {children}

            {footer && <div className="auth-footer">{footer}</div>}
          </section>
        </div>
      </main>
    </div>
  );
}
