import { TradeSide } from './schemas/trade.schema';

/**
 * Default $ value of one full price point per lot.
 * 100 fits XAUUSD ($1 move = $100/lot). Can become a per-symbol config later —
 * keep this the single source of truth (mirrored in apps/web/lib/trading.ts).
 */
export const POINT_VALUE_PER_LOT = 100;

/** Gross profit when the user didn't provide one. */
export function computeGrossProfit(
  side: TradeSide,
  openPrice: number,
  closePrice: number,
  lots: number,
): number {
  const direction = side === TradeSide.BUY ? 1 : -1;
  return direction * (closePrice - openPrice) * lots * POINT_VALUE_PER_LOT;
}
