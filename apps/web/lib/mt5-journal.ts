import type { TradeInput } from "./trading-types";
import type { ParsedCsv } from "./mt5-csv";

/**
 * Parser for the MT5 mobile app's Journal export (a .txt log file, e.g.
 * "mt5.ios.5830.txt"). The log is mostly connection noise; the trade data
 * lives in `[ Trades ]` lines:
 *
 *   … : deal #1226556151 buy 1.5 XAUUSD 4164.585 done (based on order #2186900405)
 *   … : market sell 1.5 XAUUSD, close #2186900405 buy 1.5 XAUUSD 4164.585
 *   … : modify #2186900405 buy 1.5 XAUUSD -> sl: 4165.150, tp: 0.000 done (ok)
 *
 * We pair each closing deal with its opening deal via the `close #<order>`
 * reference and emit one trade per closed position. The journal carries no
 * profit/commission/swap figures — profit is left blank so the backend
 * derives it from prices, and the broker ticket enables dedup against
 * report/CSV imports of the same trades.
 */

interface Deal {
  ts: string; // "2026.07.06 03:47:52"
  dealId: string;
  side: "buy" | "sell";
  lots: number;
  symbol: string;
  price: number;
  orderId: string;
  /** opening order id of the position this deal closes (set during pairing) */
  closesTicket?: string;
}

const DEAL_RE =
  /^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})(?:\.\d+)?\s+'[^']*'\s*:\s*deal #(\d+) (buy|sell) ([\d.]+) ([\w.#&]+) ([\d.]+) done \(based on order #(\d+)\)/;

// close request — deliberately NOT matching the echoed "accepted market …" line
const CLOSE_RE =
  /^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})(?:\.\d+)?\s+'[^']*'\s*:\s*market (buy|sell) ([\d.]+) ([\w.#&]+), close #(\d+)/;

const MODIFY_RE =
  /'\s*:\s*modify #(\d+) .*-> sl: ([\d.]+), tp: ([\d.]+) done \(ok\)/;

function toIso(ts: string): string | undefined {
  const date = new Date(ts.replace(/\./g, "-").replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseMt5Journal(text: string): ParsedCsv {
  const trades: TradeInput[] = [];
  const errors: string[] = [];

  const deals: Deal[] = [];
  const pendingCloses: { side: string; lots: number; symbol: string; ticket: string }[] = [];
  const lastSlTp = new Map<string, { sl?: number; tp?: number }>();

  for (const line of text.split(/\r?\n/)) {
    const modify = MODIFY_RE.exec(line);
    if (modify) {
      const sl = parseFloat(modify[2]);
      const tp = parseFloat(modify[3]);
      lastSlTp.set(modify[1], {
        sl: sl > 0 ? sl : undefined,
        tp: tp > 0 ? tp : undefined,
      });
      continue;
    }

    const close = CLOSE_RE.exec(line);
    if (close) {
      pendingCloses.push({
        side: close[2],
        lots: parseFloat(close[3]),
        symbol: close[4].toUpperCase(),
        ticket: close[5],
      });
      continue;
    }

    const deal = DEAL_RE.exec(line);
    if (deal) {
      const entry: Deal = {
        ts: deal[1],
        dealId: deal[2],
        side: deal[3] as Deal["side"],
        lots: parseFloat(deal[4]),
        symbol: deal[5].toUpperCase(),
        price: parseFloat(deal[6]),
        orderId: deal[7],
      };
      // a deal following a matching close request is the closing execution
      const pendingIndex = pendingCloses.findIndex(
        (p) => p.side === entry.side && p.symbol === entry.symbol && p.lots === entry.lots,
      );
      if (pendingIndex >= 0) {
        entry.closesTicket = pendingCloses[pendingIndex].ticket;
        pendingCloses.splice(pendingIndex, 1);
      }
      deals.push(entry);
    }
  }

  const openDeals = new Map<string, Deal>();
  for (const deal of deals) {
    if (!deal.closesTicket) openDeals.set(deal.orderId, deal);
  }

  for (const deal of deals) {
    if (!deal.closesTicket) continue;
    const open = openDeals.get(deal.closesTicket);
    if (!open) {
      errors.push(
        `Close of position #${deal.closesTicket} found, but its opening isn't in this log — skipped (import a report covering the open instead).`,
      );
      continue;
    }
    const slTp = lastSlTp.get(deal.closesTicket);
    trades.push({
      symbol: open.symbol,
      ticket: deal.closesTicket,
      side: open.side,
      lots: deal.lots,
      openPrice: open.price,
      closePrice: deal.price,
      sl: slTp?.sl,
      tp: slTp?.tp,
      openTime: toIso(open.ts),
      closeTime: toIso(deal.ts),
      // no P&L in the journal — backend derives gross profit from prices
      commission: 0,
      swap: 0,
    });
    openDeals.delete(deal.closesTicket);
  }

  // opening deals never closed within this log = still-open positions
  const stillOpen = [...openDeals.values()].filter(
    (d) => !trades.some((t) => t.ticket === d.orderId),
  );
  if (stillOpen.length > 0) {
    errors.push(
      `${stillOpen.length} position(s) opened but not closed in this log were skipped (still open or closed outside the log window).`,
    );
  }

  if (trades.length === 0 && errors.length === 0) {
    errors.push(
      "No completed trades found in this journal — make sure the log covers both the open and the close of your positions.",
    );
  }

  return { trades, transactions: [], errors };
}
