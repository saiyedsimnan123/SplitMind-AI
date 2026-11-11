"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useState } from "react";

export function LoginForm({
  authConfigured,
  nextPath,
  initialError,
  initialNotice,
}: {
  authConfigured: boolean;
  nextPath: string;
  initialError?: string;
  initialNotice?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [demoError, setDemoError] = useState("");
  const [notice, setNotice] = useState(initialNotice ?? "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setDemoError("");
    setNotice("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password, rememberMe }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sign-in failed. Check your credentials and try again.");
        setBusy(false);
        return;
      }
      router.push(nextPath || "/");
      router.refresh();
    } catch {
      setError("Network error while signing in. Please try again.");
      setBusy(false);
    }
  };

  const launchDemo = async () => {
    if (busy || demoBusy || !authConfigured) return;
    setDemoError("");
    setError("");
    setDemoBusy(true);
    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setDemoError(data.error ?? "Could not launch an isolated demo session.");
        setDemoBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setDemoError("Network error while starting demo session. Please try again.");
      setDemoBusy(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} noValidate>
        {notice && (
          <div className="payment-banner payment-banner-success" role="status" style={{ marginBottom: 14 }}>
            <div className="payment-banner-copy">
              <strong>{notice}</strong>
            </div>
          </div>
        )}

        <label className="form-label">
          Work or personal email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={busy || demoBusy}
            required
          />
        </label>

        <label className="form-label">
          <span className="label-row">
            <span>Password</span>
            <Link href="/forgot-password" className="inline-link">
              Forgot password?
            </Link>
          </span>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={busy || demoBusy}
              required
            />
            <button
              type="button"
              className="icon-button password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="remember-check">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={busy || demoBusy}
          />
          <span>Keep me signed in on this device (30-day HttpOnly session)</span>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button button-primary full-button"
          disabled={busy || demoBusy || !authConfigured}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />}
          {busy ? "Verifying session..." : "Sign in to SplitMind"}
        </button>
      </form>

      <div className="login-signup-prompt">
        <span>New to SplitMind AI?</span>{" "}
        <Link href="/signup" className="inline-link">
          Create your account
        </Link>
      </div>

      <div className="demo-explore-card">
        <div className="demo-explore-copy">
          <span className="demo-pill-tag">ISOLATED SANDBOX</span>
          <p>New to SplitMind AI? Explore the platform with sample financial data. No registration required.</p>
        </div>

        {demoError && (
          <p className="form-error" role="alert" style={{ marginTop: 8 }}>
            {demoError}
          </p>
        )}

        <button
          type="button"
          className="button button-demo full-button"
          onClick={() => void launchDemo()}
          disabled={busy || demoBusy || !authConfigured}
        >
          {demoBusy ? <Loader2 size={15} className="spin" /> : <Compass size={15} />}
          <span>{demoBusy ? "Creating isolated demo..." : "Explore Demo"}</span>
          {!demoBusy && <ArrowRight size={14} />}
        </button>
      </div>
    </div>
  );
}
