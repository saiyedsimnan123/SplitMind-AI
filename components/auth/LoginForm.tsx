"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Eye, EyeOff, Loader2, Lock, LogIn, Mail } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [demoError, setDemoError] = useState("");
  const [notice, setNotice] = useState(initialNotice ?? "");

  const submitSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setDemoError("");
    setNotice("");

    const trimmedEmail = email.trim().toLowerCase();
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
        body: JSON.stringify({ email: trimmedEmail, password, rememberMe: true }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Invalid email or password.");
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
        setDemoError(data.error ?? "Could not launch the isolated demo session.");
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
      {notice && (
        <div className="payment-banner payment-banner-success" role="status" style={{ marginBottom: 14 }}>
          <div className="payment-banner-copy">
            <strong>{notice}</strong>
          </div>
        </div>
      )}

      <form onSubmit={submitSignIn} noValidate>
        <label className="form-label">
          Email address
          <div className="auth-input-wrap">
            <Mail size={16} className="auth-input-icon" aria-hidden="true" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy || demoBusy}
              required
            />
          </div>
        </label>

        <label className="form-label">
          <span className="label-row">
            <span>Password</span>
            <Link href="/forgot-password" className="inline-link">
              Forgot Password?
            </Link>
          </span>
          <div className="password-field auth-input-wrap">
            <Lock size={16} className="auth-input-icon" aria-hidden="true" />
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
          {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="login-signup-prompt">
        <span>New to SplitMind AI?</span>{" "}
        <Link href="/signup" className="inline-link">
          Create Account
        </Link>
      </div>

      <div className="demo-explore-card">
        <div className="demo-explore-copy">
          <div className="demo-explore-top">
            <span className="demo-pill-tag">GOA TRIP 2026 · LIVE DEMO</span>
            <span className="demo-budget-tag">₹40,000 Budget</span>
          </div>
          <strong>Explore SplitMind without signing up</strong>
          <p>
            Try the 8-friend, 3-day Goa trip workspace with expenses, balances, MoneyTwin simulations,
            and settlements.
          </p>
        </div>

        {demoError && (
          <p className="form-error" role="alert" style={{ marginBottom: 10 }}>
            {demoError}
          </p>
        )}

        <button
          type="button"
          className="button button-demo full-button"
          onClick={() => void launchDemo()}
          disabled={busy || demoBusy || !authConfigured}
        >
          {demoBusy ? <Loader2 size={16} className="spin" /> : <Compass size={16} />}
          <span>{demoBusy ? "Launching Goa Demo..." : "Explore Demo"}</span>
          {!demoBusy && <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
}
