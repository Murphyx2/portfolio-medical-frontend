export function formatCurrencyDOP(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(num)) return "";
  return `RD$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isValidCurrencyAmount(value: string): boolean {
  if (!value.trim()) return false;
  const num = parseFloat(value);
  return !Number.isNaN(num) && num >= 0;
}
