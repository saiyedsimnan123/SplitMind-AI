type WindowEntry = {
  count: number;
  windowStart: number;
  lastAttemptAt: number;
};

const verifyFailures = new Map<string, WindowEntry>();
const resendHistory = new Map<string, WindowEntry>();

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const MAX_VERIFY_FAILURES = 5;

const RESEND_COOLDOWN_MS = 55 * 1000;
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_RESENDS_PER_WINDOW = 5;

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "local";
}

export function checkOtpVerifyAllowed(subject: string, clientIp: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const keys = [`subject:${subject.trim().toLowerCase()}`, `ip:${clientIp}`];
  for (const key of keys) {
    const entry = verifyFailures.get(key);
    if (!entry) continue;
    if (now - entry.windowStart > VERIFY_WINDOW_MS) {
      verifyFailures.delete(key);
      continue;
    }
    if (entry.count >= MAX_VERIFY_FAILURES) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((VERIFY_WINDOW_MS - (now - entry.windowStart)) / 1000),
      );
      return { allowed: false, retryAfterSeconds };
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordOtpVerifyFailure(subject: string, clientIp: string): void {
  const now = Date.now();
  const keys = [`subject:${subject.trim().toLowerCase()}`, `ip:${clientIp}`];
  for (const key of keys) {
    const existing = verifyFailures.get(key);
    if (!existing || now - existing.windowStart > VERIFY_WINDOW_MS) {
      verifyFailures.set(key, { count: 1, windowStart: now, lastAttemptAt: now });
    } else {
      verifyFailures.set(key, {
        count: existing.count + 1,
        windowStart: existing.windowStart,
        lastAttemptAt: now,
      });
    }
  }
}

export function clearOtpVerifyFailures(subject: string, clientIp: string): void {
  verifyFailures.delete(`subject:${subject.trim().toLowerCase()}`);
  verifyFailures.delete(`ip:${clientIp}`);
}

export function checkOtpResendAllowed(subject: string, clientIp: string): {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: string;
} {
  const now = Date.now();
  const subjectKey = `subject:${subject.trim().toLowerCase()}`;
  const ipKey = `ip:${clientIp}`;

  const subjectEntry = resendHistory.get(subjectKey);
  if (subjectEntry) {
    const sinceLast = now - subjectEntry.lastAttemptAt;
    if (sinceLast < RESEND_COOLDOWN_MS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000)),
        reason: "Please wait before requesting another verification code.",
      };
    }
    if (now - subjectEntry.windowStart <= RESEND_WINDOW_MS && subjectEntry.count >= MAX_RESENDS_PER_WINDOW) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((RESEND_WINDOW_MS - (now - subjectEntry.windowStart)) / 1000)),
        reason: "Maximum OTP resend limit reached. Please try again in a few minutes.",
      };
    }
  }

  const ipEntry = resendHistory.get(ipKey);
  if (ipEntry && now - ipEntry.windowStart <= RESEND_WINDOW_MS && ipEntry.count >= MAX_RESENDS_PER_WINDOW * 2) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((RESEND_WINDOW_MS - (now - ipEntry.windowStart)) / 1000)),
      reason: "Too many OTP requests from this network. Please wait a few minutes.",
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordOtpResendAttempt(subject: string, clientIp: string): void {
  const now = Date.now();
  for (const key of [`subject:${subject.trim().toLowerCase()}`, `ip:${clientIp}`]) {
    const existing = resendHistory.get(key);
    if (!existing || now - existing.windowStart > RESEND_WINDOW_MS) {
      resendHistory.set(key, { count: 1, windowStart: now, lastAttemptAt: now });
    } else {
      resendHistory.set(key, {
        count: existing.count + 1,
        windowStart: existing.windowStart,
        lastAttemptAt: now,
      });
    }
  }
}

export function resetRateLimitsForTests(): void {
  verifyFailures.clear();
  resendHistory.clear();
}
