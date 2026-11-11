"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SignupForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "otp") {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const submitSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setOtpInfo("");

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
        requiresOtpVerification?: boolean;
        requiresEmailConfirmation?: boolean;
        cooldownSeconds?: number;
        message?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not create your account.");
        setBusy(false);
        return;
      }

      if (data.requiresOtpVerification || data.requiresEmailConfirmation) {
        setEmail(trimmedEmail);
        setOtpDigits(["", "", "", "", "", ""]);
        setCooldown(data.cooldownSeconds ?? 60);
        setOtpInfo(data.message ?? "Enter the 6-digit verification code sent to your email.");
        setStep("otp");
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

  const verifyOtpCode = async (codeOverride?: string) => {
    const code = codeOverride ?? otpDigits.join("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Invalid or expired verification code.");
        setBusy(false);
        return;
      }
      setVerifiedSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 650);
    } catch {
      setError("Network error while verifying code. Please try again.");
      setBusy(false);
    }
  };

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    setError("");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      for (let i = 0; i < chars.length; i++) next[i] = chars[i];
      setOtpDigits(next);
      const focusIdx = Math.min(chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      if (chars.length === 6) {
        void verifyOtpCode(next.join(""));
      }
      return;
    }

    const next = [...otpDigits];
    next[index] = cleaned;
    setOtpDigits(next);
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = "";
        setOtpDigits(next);
      } else if (index > 0) {
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePasteOtp = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    setError("");
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) {
      void verifyOtpCode(next.join(""));
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending || busy) return;
    setError("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await response.json()) as {
        error?: string;
        cooldownSeconds?: number;
        retryAfterSeconds?: number;
        message?: string;
      };
      if (!response.ok) {
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(data.error ?? "Could not resend verification code.");
      } else {
        setCooldown(data.cooldownSeconds ?? 60);
        setOtpInfo(data.message ?? "A fresh 6-digit verification code has been sent.");
        setOtpDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Network error while resending code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (verifiedSuccess) {
    return (
      <div className="payment-banner payment-banner-success" role="status">
        <div className="payment-banner-icon">
          <CheckCircle2 size={18} />
        </div>
        <div className="payment-banner-copy">
          <strong>Email verified</strong>
          <p>Your SplitMind workspace is ready. Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    const codeComplete = otpDigits.every((d) => /^\d$/.test(d));
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verifyOtpCode();
        }}
        noValidate
      >
        <div className="otp-recipient-card">
          <span className="otp-mail-icon">
            <MailCheck size={18} />
          </span>
          <div>
            <strong>6-digit code sent to</strong>
            <span>{email}</span>
          </div>
          <button
            type="button"
            className="otp-change-email"
            disabled={busy}
            onClick={() => {
              setStep("form");
              setError("");
              setOtpInfo("");
            }}
          >
            <ArrowLeft size={12} /> Change email
          </button>
        </div>

        {otpInfo && !error && (
          <p className="otp-helper-note" role="status">
            {otpInfo}
          </p>
        )}

        <div className="otp-box-group" role="group" aria-label="6-digit email verification code">
          {otpDigits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Verification digit ${index + 1} of 6`}
              className={`otp-digit-input ${digit ? "filled" : ""} ${error ? "has-error" : ""}`}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleDigitKeyDown(index, e)}
              onPaste={handlePasteOtp}
              disabled={busy}
            />
          ))}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="button button-primary full-button"
          disabled={busy || !codeComplete}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
          {busy ? "Verifying 6-digit code..." : "Verify & enter workspace"}
        </button>

        <div className="otp-resend-row">
          <span>Didn&apos;t receive the code?</span>
          <button
            type="button"
            className="otp-resend-btn"
            disabled={cooldown > 0 || resending || busy}
            onClick={() => void handleResendOtp()}
          >
            {resending ? (
              <>
                <Loader2 size={12} className="spin" /> Sending...
              </>
            ) : cooldown > 0 ? (
              `Resend OTP in ${cooldown}s`
            ) : (
              <>
                <RefreshCw size={12} /> Resend OTP
              </>
            )}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitSignup} noValidate>
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
        <small>Minimum 8 characters. We&apos;ll send a 6-digit OTP to verify your email.</small>
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
        {busy ? "Sending verification code..." : "Create Account"}
      </button>
    </form>
  );
}
