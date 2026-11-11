"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { PhoneInputField } from "@/components/auth/PhoneInputField";
import { DEFAULT_COUNTRY_DIAL_CODE, validateAndFormatPhone } from "@/lib/phone";

export function SignupForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
  const [localNumber, setLocalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length > 80) {
      setError("Enter your full name (under 80 characters).");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    let normalizedPhone: string | undefined;
    if (localNumber.trim()) {
      const check = validateAndFormatPhone(countryCode, localNumber);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      normalizedPhone = check.e164;
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
        body: JSON.stringify({
          fullName: trimmedName,
          email: trimmedEmail,
          password,
          ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not create your account.");
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

  return (
    <form onSubmit={submitCreateAccount} noValidate>
      <label className="form-label">
        Full name
        <div className="auth-input-wrap">
          <User size={16} className="auth-input-icon" aria-hidden="true" />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Aarav Patel"
            autoComplete="name"
            disabled={busy}
            required
          />
        </div>
      </label>

      <label className="form-label">
        Email address
        <div className="auth-input-wrap">
          <Mail size={16} className="auth-input-icon" aria-hidden="true" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={busy}
            required
          />
        </div>
      </label>

      <PhoneInputField
        countryCode={countryCode}
        localNumber={localNumber}
        disabled={busy}
        required={false}
        onChangeCountryCode={setCountryCode}
        onChangeLocalNumber={setLocalNumber}
      />

      <label className="form-label">
        Password
        <div className="password-field auth-input-wrap">
          <Lock size={16} className="auth-input-icon" aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
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

      <label className="form-label">
        Confirm password
        <div className="password-field auth-input-wrap">
          <Lock size={16} className="auth-input-icon" aria-hidden="true" />
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            disabled={busy}
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

      <button type="submit" className="button button-primary full-button" disabled={busy || !authConfigured}>
        {busy ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
        {busy ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}
