"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

export function SignupForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setConfirmationMessage("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || trimmedName.length > 80) {
      setError("Enter your full name (under 80 characters).");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: trimmedName, email: trimmedEmail, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        requiresEmailConfirmation?: boolean;
        message?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not create your account.");
        setBusy(false);
        return;
      }
      if (data.requiresEmailConfirmation) {
        setConfirmationMessage(
          data.message ?? "Check your inbox for a confirmation link before signing in.",
        );
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error while creating account. Please try again.");
      setBusy(false);
    }
  };

  if (confirmationMessage) {
    return (
      <div className="payment-banner payment-banner-success" role="status">
        <div className="payment-banner-icon">
          <CheckCircle2 size={18} />
        </div>
        <div className="payment-banner-copy">
          <strong>Verify your email</strong>
          <p>{confirmationMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="form-label">
        Full name
        <input
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Alex Kim"
          disabled={busy}
          required
        />
      </label>

      <label className="form-label">
        Email address
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
        Password
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
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
        <small>Minimum 8 characters. Protected with server-side Supabase Auth.</small>
      </label>

      <label className="form-label">
        Confirm password
        <input
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
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
        {busy ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />}
        {busy ? "Provisioning workspace..." : "Create SplitMind account"}
      </button>
    </form>
  );
}
