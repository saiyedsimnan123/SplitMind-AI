"use client";

import { Phone } from "lucide-react";
import { COUNTRY_DIAL_OPTIONS } from "@/lib/phone";

export function PhoneInputField({
  countryCode,
  localNumber,
  disabled = false,
  onChangeCountryCode,
  onChangeLocalNumber,
}: {
  countryCode: string;
  localNumber: string;
  disabled?: boolean;
  onChangeCountryCode: (value: string) => void;
  onChangeLocalNumber: (value: string) => void;
}) {
  return (
    <div className="form-label">
      <span>Mobile phone number</span>
      <div className="phone-input-group">
        <select
          aria-label="Country code"
          className="phone-country-select"
          value={countryCode}
          onChange={(e) => onChangeCountryCode(e.target.value)}
          disabled={disabled}
        >
          {COUNTRY_DIAL_OPTIONS.map((option) => (
            <option key={`${option.iso}-${option.dialCode}`} value={option.dialCode}>
              {option.iso} ({option.dialCode}) — {option.name}
            </option>
          ))}
        </select>

        <div className="phone-number-wrap">
          <Phone size={15} className="phone-field-icon" aria-hidden="true" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-label="Mobile phone number"
            value={localNumber}
            onChange={(e) => onChangeLocalNumber(e.target.value)}
            placeholder={countryCode === "+91" ? "98765 43210" : "Phone number"}
            disabled={disabled}
            required
          />
        </div>
      </div>
      <small className="phone-input-hint">
        SMS OTP delivered via Supabase Phone Auth &amp; Twilio ({countryCode} default)
      </small>
    </div>
  );
}
