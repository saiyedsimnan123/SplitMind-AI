"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  MessageSquareCode,
  Phone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GoogleContinueButton } from "@/components/auth/GoogleContinueButton";
import { OtpVerificationPanel } from "@/components/auth/OtpVerificationPanel";
import { PhoneInputField } from "@/components/auth/PhoneInputField";
import { DEFAULT_COUNTRY_DIAL_CODE, validateAndFormatPhone } from "@/lib/phone";

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
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [emailMode, setEmailMode] = useState<"password" | "otp">("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
  const [localNumber, setLocalNumber] = useState("");
  const [verifiedPhoneE164, setVerifiedPhoneE164] = useState("");

  const [otpStep, setOtpStep] = useState<null | "email" | "phone">(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpInfo, setOtpInfo] = useState("");
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [demoError, setDemoError] = useState("");
  const [notice, setNotice] = useState(initialNotice ?? "");

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

  const submitEmailPassword = async (event: React.FormEvent) => {
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

  const sendEmailLoginOtp = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError("");
    setNotice("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (otpStep === "email") {
      setResending(true);
    } else {
      setBusy(true);
    }
    try {
      const endpoint = otpStep === "email" ? "/api/auth/resend-otp" : "/api/auth/email-otp/send";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          otpStep === "email" ? { email: trimmedEmail, mode: "login" } : { email: trimmedEmail },
        ),
      });
      const data = (await response.json()) as {
        error?: string;
        cooldownSeconds?: number;
        retryAfterSeconds?: number;
        message?: string;
      };
      if (!response.ok) {
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        setError(data.error ?? "Could not send email verification code.");
      } else {
        setEmail(trimmedEmail);
        setCooldown(data.cooldownSeconds ?? 60);
        setOtpInfo(data.message ?? "Enter the 6-digit login code sent to your email.");
        setOtpStep("email");
      }
    } catch {
      setError("Network error while sending verification code. Please try again.");
    } finally {
      setBusy(false);
      setResending(false);
    }
  };

  const verifyEmailLoginOtp = async (code: string) => {
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
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: code,
          mode: "login",
          rememberMe,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Invalid or expired verification code.");
        setBusy(false);
        return;
      }
      setVerifiedSuccess(true);
      setTimeout(() => {
        router.push(nextPath || "/");
        router.refresh();
      }, 500);
    } catch {
      setError("Network error while verifying code. Please try again.");
      setBusy(false);
    }
  };

  const sendPhoneLoginOtp = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError("");
    setNotice("");

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
          mode: "login",
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
      setError("Network error while requesting SMS OTP. Please try again.");
    } finally {
      setBusy(false);
      setResending(false);
    }
  };

  const verifyPhoneLoginOtp = async (code: string) => {
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
          rememberMe,
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
        router.push(nextPath || "/");
        router.refresh();
      }, 500);
    } catch {
      setError("Network error while verifying SMS code. Please try again.");
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
      {notice && (
        <div className="payment-banner payment-banner-success" role="status" style={{ marginBottom: 14 }}>
          <div className="payment-banner-copy">
            <strong>{notice}</strong>
          </div>
        </div>
      )}

      {!otpStep && (
        <>
          <GoogleContinueButton
            authConfigured={authConfigured}
            nextPath={nextPath}
            disabled={busy || demoBusy}
            label="Continue with Google"
          />

          <div className="auth-divider" role="separator">
            <span>or sign in with</span>
          </div>

          <div className="auth-channel-toggle" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={channel === "email"}
              className={`auth-channel-btn ${channel === "email" ? "active" : ""}`}
              onClick={() => switchChannel("email")}
              disabled={busy || demoBusy}
            >
              <Mail size={14} /> Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={channel === "phone"}
              className={`auth-channel-btn ${channel === "phone" ? "active" : ""}`}
              onClick={() => switchChannel("phone")}
              disabled={busy || demoBusy}
            >
              <Phone size={14} /> Phone (+91)
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
          successTitle="Email OTP verified"
          successSubtitle="Your SplitMind session is active. Redirecting to dashboard…"
          onClearError={() => setError("")}
          onBack={() => {
            setOtpStep(null);
            setError("");
            setOtpInfo("");
          }}
          onVerify={verifyEmailLoginOtp}
          onResend={() => sendEmailLoginOtp()}
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
          successTitle="Phone verified"
          successSubtitle="Your SplitMind session is active. Redirecting to dashboard…"
          onClearError={() => setError("")}
          onBack={() => {
            setOtpStep(null);
            setError("");
            setOtpInfo("");
          }}
          onVerify={verifyPhoneLoginOtp}
          onResend={() => sendPhoneLoginOtp()}
        />
      ) : channel === "email" ? (
        <div>
          <div className="auth-submode-strip" role="group" aria-label="Email authentication option">
            <button
              type="button"
              className={`auth-submode-btn ${emailMode === "password" ? "active" : ""}`}
              onClick={() => {
                setEmailMode("password");
                setError("");
              }}
              disabled={busy || demoBusy}
            >
              <KeyRound size={12} /> Password
            </button>
            <button
              type="button"
              className={`auth-submode-btn ${emailMode === "otp" ? "active" : ""}`}
              onClick={() => {
                setEmailMode("otp");
                setError("");
              }}
              disabled={busy || demoBusy}
            >
              <MessageSquareCode size={12} /> 6-digit Email OTP
            </button>
          </div>

          {emailMode === "password" ? (
            <form onSubmit={submitEmailPassword} noValidate>
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
                {busy ? "Verifying session..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void sendEmailLoginOtp(e)} noValidate>
              <label className="form-label">
                Verified email address
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
                {busy ? <Loader2 size={15} className="spin" /> : <Mail size={15} />}
                {busy ? "Sending 6-digit OTP..." : "Send 6-digit Email OTP"}
              </button>
            </form>
          )}
        </div>
      ) : (
        <form onSubmit={(e) => void sendPhoneLoginOtp(e)} noValidate>
          <PhoneInputField
            countryCode={countryCode}
            localNumber={localNumber}
            disabled={busy || demoBusy}
            onChangeCountryCode={setCountryCode}
            onChangeLocalNumber={setLocalNumber}
          />

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
            {busy ? <Loader2 size={15} className="spin" /> : <MessageSquareCode size={15} />}
            {busy ? "Sending SMS OTP..." : "Send 6-digit SMS OTP"}
          </button>
        </form>
      )}

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
