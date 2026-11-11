export type CountryDialOption = {
  iso: string;
  name: string;
  dialCode: string;
};

export const DEFAULT_COUNTRY_DIAL_CODE = "+91";

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { iso: "IN", name: "India", dialCode: "+91" },
  { iso: "US", name: "United States", dialCode: "+1" },
  { iso: "GB", name: "United Kingdom", dialCode: "+44" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971" },
  { iso: "SG", name: "Singapore", dialCode: "+65" },
  { iso: "AU", name: "Australia", dialCode: "+61" },
  { iso: "CA", name: "Canada", dialCode: "+1" },
  { iso: "DE", name: "Germany", dialCode: "+49" },
  { iso: "FR", name: "France", dialCode: "+33" },
  { iso: "JP", name: "Japan", dialCode: "+81" },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966" },
  { iso: "MY", name: "Malaysia", dialCode: "+60" },
  { iso: "ID", name: "Indonesia", dialCode: "+62" },
  { iso: "TH", name: "Thailand", dialCode: "+66" },
  { iso: "NL", name: "Netherlands", dialCode: "+31" },
  { iso: "QA", name: "Qatar", dialCode: "+974" },
];

export type PhoneValidationResult =
  | { ok: true; e164: string; countryCode: string; nationalNumber: string }
  | { ok: false; error: string };

const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const DIAL_CODE_REGEX = /^\+[1-9]\d{0,3}$/;

export function normalizeDialCode(raw: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export function validateAndFormatPhone(
  countryCodeRaw: string,
  localNumberRaw: string,
): PhoneValidationResult {
  const dialCode = normalizeDialCode(countryCodeRaw || DEFAULT_COUNTRY_DIAL_CODE);
  if (!DIAL_CODE_REGEX.test(dialCode)) {
    return { ok: false, error: "Select a valid country dial code (e.g. +91)." };
  }

  const trimmedLocal = localNumberRaw.trim();
  if (!trimmedLocal) {
    return { ok: false, error: "Enter your mobile phone number." };
  }
  if (/[a-zA-Z]/.test(trimmedLocal)) {
    return { ok: false, error: "Phone numbers must contain digits only." };
  }

  let digits = trimmedLocal.replace(/\D/g, "");
  const dialDigits = dialCode.slice(1);

  // If the user pasted a full international number including the selected country code, strip it once.
  if (trimmedLocal.startsWith("+") && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  // Strip a single national trunk '0' prefix when entered (common for India/UK local formats).
  if (digits.startsWith("0") && digits.length > 7) {
    digits = digits.replace(/^0+/, "");
  }

  if (!digits) {
    return { ok: false, error: "Enter your mobile phone number." };
  }

  if (dialCode === "+91") {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return {
        ok: false,
        error: "Enter a valid 10-digit Indian mobile number (starting with 6–9).",
      };
    }
  } else if (dialCode === "+1") {
    if (!/^[2-9]\d{9}$/.test(digits)) {
      return {
        ok: false,
        error: "Enter a valid 10-digit US/Canada phone number.",
      };
    }
  }

  const e164 = `+${dialDigits}${digits}`;
  if (!E164_REGEX.test(e164)) {
    return {
      ok: false,
      error: "Enter a valid international phone number (8 to 15 digits including country code).",
    };
  }

  return {
    ok: true,
    e164,
    countryCode: dialCode,
    nationalNumber: digits,
  };
}

export function validateE164Phone(phoneRaw: string): PhoneValidationResult {
  const trimmed = phoneRaw.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return { ok: false, error: "Phone numbers must contain digits only." };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Enter a valid phone number." };
  }

  const e164 = `+${digits}`;
  if (!E164_REGEX.test(e164)) {
    return {
      ok: false,
      error: "Enter a valid international phone number in E.164 format (e.g. +919876543210).",
    };
  }

  if (e164.startsWith("+91")) {
    const national = e164.slice(3);
    if (!/^[6-9]\d{9}$/.test(national)) {
      return {
        ok: false,
        error: "Enter a valid 10-digit Indian mobile number after +91.",
      };
    }
    return { ok: true, e164, countryCode: "+91", nationalNumber: national };
  }

  const matchedCountry = COUNTRY_DIAL_OPTIONS.find(
    (opt) => opt.dialCode !== "+1" && e164.startsWith(opt.dialCode),
  );
  const countryCode = matchedCountry?.dialCode ?? `+${digits.slice(0, digits.startsWith("1") ? 1 : 2)}`;
  const nationalNumber = e164.slice(countryCode.length);

  return { ok: true, e164, countryCode, nationalNumber };
}
