import { CURRENCY, LOCALE } from "./constants";

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return currencyFmt.format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return numberFmt.format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

/** ISO date (yyyy-mm-dd or full ISO) -> localized short date. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today as yyyy-mm-dd, suitable for <input type="date"> defaults. */
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}
