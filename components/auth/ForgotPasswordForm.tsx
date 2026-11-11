"use client";

import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";

export function ForgotPasswordForm({ authConfigured }: { authConfigured: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentMessage, setSentMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSentMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not send password reset email.");
        setBusy(false);
        return;
      }
      setSentMessage(
        data.message ?? "If an account matches that email, a password reset link has been sent.",
      );
    } catch {
      setError("Network error while sending reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {sentMessage && (
        <div className="payment-banner payment-banner-success" role="status" style={{ marginBottom: 14 }}>
          <div className="payment-banner-icon">
            <CheckCircle2 size={18} />
          </div>
          <div className="payment-banner-copy">
            <strong>Reset link requested</strong>
            <p>{sentMessage}</p>
          </div>
        </div>
      )}

      <label className="form-label">
        Account email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={busy}
          required
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="button button-primary full-button" disabled={busy || !authConfigured}>
        {busy ? <Loader2 size={15} className="spin" /> : <Mail size={15} />}
        {busy ? "Sending reset link..." : "Send password reset link"}
      </button>
    </form>
  );
}
