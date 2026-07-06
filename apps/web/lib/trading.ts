import type { TradeSide } from "./trading-types";

/**
 * $ value of one full price point per lot — MUST match the backend constant
 * in apps/api/src/trading/trading.util.ts. 100 fits XAUUSD.
 */
export const POINT_VALUE_PER_LOT = 100;

/** Same formula as the backend uses when `profit` is omitted. */
export function computeGrossProfit(
  side: TradeSide,
  openPrice: number,
  closePrice: number,
  lots: number,
): number {
  const direction = side === "buy" ? 1 : -1;
  return direction * (closePrice - openPrice) * lots * POINT_VALUE_PER_LOT;
}

export function fmtMoney(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtSignedMoney(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function fmtPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** tailwind text color by sign — gold for zero/neutral */
export function pnlClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-amber-400";
  return value > 0 ? "text-emerald-400" : "text-red-400";
}
