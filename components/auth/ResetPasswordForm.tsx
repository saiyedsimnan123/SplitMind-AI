"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";

export function ResetPasswordForm({
  authConfigured,
  hasRecoverySession,
  tokenHash,
  type,
  initialError,
}: {
  authConfigured: boolean;
  hasRecoverySession: boolean;
  tokenHash?: string;
  type?: string;
  initialError?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [establishingRecovery, setEstablishingRecovery] = useState(false);
  const [sessionReady, setSessionReady] = useState(hasRecoverySession);
  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authConfigured || sessionReady || typeof window === "undefined") return;
    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash) return;

    const hashParams = new URLSearchParams(rawHash);
    const errorDesc = hashParams.get("error_description");
    if (errorDesc) {
      setError(errorDesc);
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
      return;
    }

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    setEstablishingRecovery(true);
    fetch("/api/auth/recovery-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Recovery link is invalid or expired.");
        setSessionReady(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not verify recovery link.");
      })
      .finally(() => {
        setEstablishingRecovery(false);
      });
  }, [authConfigured, sessionReady]);

  const canAttemptReset = authConfigured && (sessionReady || Boolean(tokenHash));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Choose a new password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, tokenHash, type }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? `Could not reset password (HTTP ${response.status}).`);
        setBusy(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.assign("/login?reset=1");
      }, 1200);
    } catch {
      setError("Network error while resetting password. Please try again.");
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div className="payment-banner payment-banner-success" role="status">
        <div className="payment-banner-icon">
          <CheckCircle2 size={18} />
        </div>
        <div className="payment-banner-copy">
          <strong>Password updated</strong>
          <p>Redirecting you to sign in with your new password…</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {establishingRecovery && (
        <div className="payment-banner payment-banner-pending" role="status" style={{ marginBottom: 14 }}>
          <Loader2 size={16} className="spin" />
          <div className="payment-banner-copy">
            <strong>Verifying recovery link…</strong>
          </div>
        </div>
      )}

      {authConfigured && !establishingRecovery && !sessionReady && !tokenHash && (
        <div className="receipt-missing-box" role="status" style={{ marginBottom: 14 }}>
          <div>
            <strong>Recovery link required</strong>
            <p>
              Open the reset link sent to your email, or{" "}
              <Link href="/forgot-password" className="inline-link">
                request a new password reset link
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <label className="form-label">
        New password
        <div className="password-field auth-input-wrap">
          <Lock size={16} className="auth-input-icon" aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            disabled={busy || !canAttemptReset}
            required
          />
          <button
            type="button"
            className="icon-button password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide new password" : "Show new password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <label className="form-label">
        Confirm new password
        <div className="password-field auth-input-wrap">
          <Lock size={16} className="auth-input-icon" aria-hidden="true" />
          <input
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            disabled={busy || !canAttemptReset}
            required
          />
          <button
            type="button"
            className="icon-button password-toggle"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="button button-primary full-button" disabled={busy || !canAttemptReset}>
        {busy ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />}
        {busy ? "Updating password..." : "Update Password"}
      </button>
    </form>
  );
}
