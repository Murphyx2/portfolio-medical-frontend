import { describe, expect, it } from "vitest";

import { formatPhone, formatPhoneInput, isValidPhone, stripToDigits } from "./phone";

describe("phone helpers", () => {
  it("stripToDigits removes separators and letters", () => {
    expect(stripToDigits("(809) 555-1212")).toBe("8095551212");
    expect(stripToDigits("abc8095551212")).toBe("8095551212");
  });

  it("formatPhone renders (809) 555-1212 for 10 digits", () => {
    expect(formatPhone("8095551212")).toBe("(809) 555-1212");
    expect(formatPhone("(809) 555-1212")).toBe("(809) 555-1212");
  });

  it("formatPhone leaves masked (IT/CM) values untouched", () => {
    expect(formatPhone("80••••00")).toBe("80••••00");
    expect(formatPhone("+1••••00")).toBe("+1••••00");
  });

  it("formatPhone leaves empty and non-10-digit values untouched", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("5551212")).toBe("5551212");
    expect(formatPhone("112345678901")).toBe("112345678901");
  });

  it("formatPhoneInput builds the format progressively", () => {
    expect(formatPhoneInput("809")).toBe("(809");
    expect(formatPhoneInput("809555")).toBe("(809) 555");
    expect(formatPhoneInput("8095551212")).toBe("(809) 555-1212");
    expect(formatPhoneInput("809555121234567")).toBe("(809) 555-1212");
  });

  it("isValidPhone accepts empty (optional field) and exactly 10 digits", () => {
    expect(isValidPhone("")).toBe(true);
    expect(isValidPhone("   ")).toBe(true);
    expect(isValidPhone("(809) 555-1212")).toBe(true);
    expect(isValidPhone("809-555-1212")).toBe(true);
  });

  it("isValidPhone rejects letters and invalid lengths", () => {
    expect(isValidPhone("809555121")).toBe(false);
    expect(isValidPhone("80955512123")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
    expect(isValidPhone("(809) 555-121")).toBe(false);
  });
});
