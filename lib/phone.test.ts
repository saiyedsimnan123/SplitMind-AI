import { describe, expect, it } from "vitest";
import { maskPhoneForAudit } from "@/lib/audit";
import { validateAndFormatPhone, validateE164Phone } from "@/lib/phone";

describe("International & India (+91) phone validation", () => {
  it("normalizes Indian mobile numbers (+91) including spaces and leading 0", () => {
    const clean = validateAndFormatPhone("+91", "98765 43210");
    expect(clean).toEqual({
      ok: true,
      e164: "+919876543210",
      countryCode: "+91",
      nationalNumber: "9876543210",
    });

    const withZero = validateAndFormatPhone("+91", "098765-43210");
    expect(withZero).toEqual({
      ok: true,
      e164: "+919876543210",
      countryCode: "+91",
      nationalNumber: "9876543210",
    });
  });

  it("supports international numbers and rejects invalid inputs", () => {
    expect(validateAndFormatPhone("+44", "7911 123456")).toMatchObject({
      ok: true,
      e164: "+447911123456",
    });
    expect(validateAndFormatPhone("+1", "415-555-2671")).toMatchObject({
      ok: true,
      e164: "+14155552671",
    });
    expect(validateAndFormatPhone("+91", "12345").ok).toBe(false);
    expect(validateAndFormatPhone("+91", "98765abc10").ok).toBe(false);
    expect(validateE164Phone("+919876543210")).toMatchObject({
      ok: true,
      e164: "+919876543210",
    });
    expect(maskPhoneForAudit("+919876543210")).toBe("+91••••3210");
  });
});
