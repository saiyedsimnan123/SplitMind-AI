"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
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
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState(initialNotice ?? "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
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

  return (
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
          disabled={busy}
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
            disabled={busy}
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
          disabled={busy}
        />
        <span>Keep me signed in on this device (30-day HttpOnly session)</span>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="button button-primary full-button" disabled={busy || !authConfigured}>
        {busy ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />}
        {busy ? "Verifying session..." : "Sign in to SplitMind"}
      </button>
    </form>
  );
}
