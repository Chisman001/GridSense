export function formatInputNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function toEditableNumberString(value: number, decimals = 0): string {
  if (!Number.isFinite(value) || value === 0) {
    return "";
  }

  if (decimals > 0) {
    return value
      .toFixed(decimals)
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "");
  }

  return String(value);
}

export function parseFormattedNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
