"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

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
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [success, setSuccess] = useState(false);

  const canAttemptReset = authConfigured && (hasRecoverySession || Boolean(tokenHash));

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
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not reset password.");
        setBusy(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/login?reset=1");
        router.refresh();
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
      {authConfigured && !hasRecoverySession && !tokenHash && (
        <div className="receipt-missing-box" role="status" style={{ marginBottom: 14 }}>
          <div>
            <strong>Recovery session missing</strong>
            <p>
              Open the reset link from your email, or{" "}
              <Link href="/forgot-password" className="inline-link">
                request a new password reset email
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <label className="form-label">
        New password
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          disabled={busy || !canAttemptReset}
          required
        />
      </label>

      <label className="form-label">
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
          disabled={busy || !canAttemptReset}
          required
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="button button-dark full-button" disabled={busy || !canAttemptReset}>
        {busy ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
        {busy ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
