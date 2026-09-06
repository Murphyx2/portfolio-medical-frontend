export function stripToDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPhone(value: string): string {
  if (!value) return "";
  if (value.includes("•")) return value;
  const digits = stripToDigits(value);
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatPhoneInput(value: string): string {
  if (!value) return "";
  if (value.includes("•")) return value;
  const digits = stripToDigits(value).slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhone(value: string): boolean {
  if (!value.trim()) return true;
  return stripToDigits(value).length === 10;
}

export function isValidRequiredPhone(value: string): boolean {
  return value.trim() !== "" && isValidPhone(value);
}
