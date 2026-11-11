"use client";

import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageSquareCode,
  Phone,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GoogleContinueButton } from "@/components/auth/GoogleContinueButton";
import { OtpVerificationPanel } from "@/components/auth/OtpVerificationPanel";
import { PhoneInputField } from "@/components/auth/PhoneInputField";
import { DEFAULT_COUNTRY_DIAL_CODE, validateAndFormatPhone } from "@/lib/phone";

export function SignupForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [otpStep, setOtpStep] = useState<null | "email" | "phone">(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
  const [localNumber, setLocalNumber] = useState("");
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState("");

  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const switchChannel = (nextChannel: "email" | "phone") => {
    setChannel(nextChannel);
    setOtpStep(null);
    setError("");
    setOtpInfo("");
  };

  const submitEmailSignup = async (event: React.FormEvent) => {
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
        setCooldown(data.cooldownSeconds ?? 60);
        setOtpInfo(data.message ?? "Enter the 6-digit verification code sent to your email.");
        setOtpStep("email");
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

  const verifyEmailOtpCode = async (code: string) => {
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), token: code, mode: "signup" }),
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

  const resendEmailOtp = async () => {
    if (cooldown > 0 || resending || busy) return;
    setError("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), mode: "signup" }),
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
      }
    } catch {
      setError("Network error while resending code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const submitPhoneSignup = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError("");
    setOtpInfo("");

    const trimmedName = fullName.trim();
    if (otpStep !== "phone" && (!trimmedName || trimmedName.length > 80)) {
      setError("Enter your full name (under 80 characters).");
      return;
    }

    const check = validateAndFormatPhone(countryCode, localNumber);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    if (otpStep === "phone") {
      setResending(true);
    } else {
      setBusy(true);
    }

    try {
      const response = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          countryCode,
          localNumber,
          fullName: trimmedName || undefined,
          mode: "signup",
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        phone?: string;
        cooldownSeconds?: number;
        retryAfterSeconds?: number;
        message?: string;
      };
      if (!response.ok) {
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(data.error ?? "Could not send SMS verification code.");
      } else {
        setVerifiedPhoneE164(data.phone ?? check.e164);
        setCooldown(data.cooldownSeconds ?? 60);
        setOtpInfo(data.message ?? `Enter the 6-digit SMS code sent to ${check.e164}.`);
        setOtpStep("phone");
      }
    } catch {
      setError("Network error while sending SMS OTP. Please try again.");
    } finally {
      setBusy(false);
      setResending(false);
    }
  };

  const verifyPhoneSignupOtp = async (code: string) => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the complete 6-digit SMS verification code.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: verifiedPhoneE164,
          token: code,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Invalid or expired SMS code.");
        setBusy(false);
        return;
      }
      setVerifiedSuccess(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 650);
    } catch {
      setError("Network error while verifying SMS code. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      {!otpStep && (
        <>
          <GoogleContinueButton
            authConfigured={authConfigured}
            disabled={busy}
            label="Continue with Google"
          />

          <div className="auth-divider" role="separator">
            <span>or create account with</span>
          </div>

          <div className="auth-channel-toggle" role="tablist" aria-label="Registration method">
            <button
              type="button"
              role="tab"
              aria-selected={channel === "email"}
              className={`auth-channel-btn ${channel === "email" ? "active" : ""}`}
              onClick={() => switchChannel("email")}
              disabled={busy}
            >
              <Mail size={14} /> Sign up with Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={channel === "phone"}
              className={`auth-channel-btn ${channel === "phone" ? "active" : ""}`}
              onClick={() => switchChannel("phone")}
              disabled={busy}
            >
              <Phone size={14} /> Sign up with Phone
            </button>
          </div>
        </>
      )}

      {otpStep === "email" ? (
        <OtpVerificationPanel
          channel="email"
          targetLabel={email}
          changeLabel="Change email"
          helperInfo={otpInfo}
          error={error}
          busy={busy}
          resending={resending}
          cooldown={cooldown}
          verifiedSuccess={verifiedSuccess}
          successTitle="Email verified"
          successSubtitle="Your SplitMind workspace is ready. Redirecting to dashboard…"
          onClearError={() => setError("")}
          onBack={() => {
            setOtpStep(null);
            setError("");
            setOtpInfo("");
          }}
          onVerify={verifyEmailOtpCode}
          onResend={resendEmailOtp}
        />
      ) : otpStep === "phone" ? (
        <OtpVerificationPanel
          channel="phone"
          targetLabel={verifiedPhoneE164}
          changeLabel="Change phone"
          helperInfo={otpInfo}
          error={error}
          busy={busy}
          resending={resending}
          cooldown={cooldown}
          verifiedSuccess={verifiedSuccess}
          successTitle="Phone number verified"
          successSubtitle="Your SplitMind workspace is ready. Redirecting to dashboard…"
          onClearError={() => setError("")}
          onBack={() => {
            setOtpStep(null);
            setError("");
            setOtpInfo("");
          }}
          onVerify={verifyPhoneSignupOtp}
          onResend={() => submitPhoneSignup()}
        />
      ) : channel === "email" ? (
        <form onSubmit={submitEmailSignup} noValidate>
          <label className="form-label">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Aarav Patel"
              autoComplete="name"
              disabled={busy}
              required
            />
          </label>

          <label className="form-label">
            Work or personal email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              disabled={busy}
              required
            />
          </label>

          <label className="form-label">
            Password
            <div className="password-field">
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
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
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
            {busy ? "Sending verification code..." : "Create account & send Email OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void submitPhoneSignup(e)} noValidate>
          <label className="form-label">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Aarav Patel"
              autoComplete="name"
              disabled={busy}
              required
            />
          </label>

          <PhoneInputField
            countryCode={countryCode}
            localNumber={localNumber}
            disabled={busy}
            onChangeCountryCode={setCountryCode}
            onChangeLocalNumber={setLocalNumber}
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button button-primary full-button" disabled={busy || !authConfigured}>
            {busy ? <Loader2 size={15} className="spin" /> : <MessageSquareCode size={15} />}
            {busy ? "Sending SMS OTP..." : "Create account & send SMS OTP"}
          </button>
        </form>
      )}
    </div>
  );
}
