"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MailCheck,
  MessageSquareCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function OtpVerificationPanel({
  channel,
  targetLabel,
  changeLabel,
  helperInfo,
  error,
  busy,
  resending,
  cooldown,
  verifiedSuccess,
  successTitle,
  successSubtitle,
  onClearError,
  onBack,
  onVerify,
  onResend,
}: {
  channel: "email" | "phone";
  targetLabel: string;
  changeLabel: string;
  helperInfo: string;
  error: string;
  busy: boolean;
  resending: boolean;
  cooldown: number;
  verifiedSuccess: boolean;
  successTitle: string;
  successSubtitle: string;
  onClearError: () => void;
  onBack: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}) {
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [targetLabel]);

  if (verifiedSuccess) {
    return (
      <div className="payment-banner payment-banner-success" role="status">
        <div className="payment-banner-icon">
          <CheckCircle2 size={18} />
        </div>
        <div className="payment-banner-copy">
          <strong>{successTitle}</strong>
          <p>{successSubtitle}</p>
        </div>
      </div>
    );
  }

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    onClearError();
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
      inputRefs.current[Math.min(chars.length, 5)]?.focus();
      if (chars.length === 6) {
        void onVerify(next.join(""));
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
    onClearError();
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) {
      void onVerify(next.join(""));
    }
  };

  const handleResendClick = async () => {
    if (cooldown > 0 || resending || busy) return;
    await onResend();
    setOtpDigits(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  const codeComplete = otpDigits.every((d) => /^\d$/.test(d));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onVerify(otpDigits.join(""));
      }}
      noValidate
    >
      <div className="otp-recipient-card">
        <span className="otp-mail-icon">
          {channel === "phone" ? <MessageSquareCode size={18} /> : <MailCheck size={18} />}
        </span>
        <div>
          <strong>6-digit code sent to</strong>
          <span>{targetLabel}</span>
        </div>
        <button
          type="button"
          className="otp-change-email"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft size={12} /> {changeLabel}
        </button>
      </div>

      {helperInfo && !error && (
        <p className="otp-helper-note" role="status">
          {helperInfo}
        </p>
      )}

      <div
        className="otp-box-group"
        role="group"
        aria-label={`6-digit ${channel === "phone" ? "SMS" : "email"} verification code`}
      >
        {otpDigits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={6}
            aria-label={`OTP digit ${index + 1}`}
            value={digit}
            disabled={busy}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleDigitKeyDown(index, e)}
            onPaste={handlePasteOtp}
            className={`otp-digit-input ${digit ? "filled" : ""} ${error ? "has-error" : ""}`}
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
        {busy ? "Verifying 6-digit code..." : "Verify & continue"}
      </button>

      <div className="otp-resend-row">
        <span>Didn&apos;t receive the code?</span>
        <button
          type="button"
          className="otp-resend-btn"
          disabled={cooldown > 0 || resending || busy}
          onClick={() => void handleResendClick()}
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
