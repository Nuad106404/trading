import Papa from "papaparse";
import type { CashInput, TradeInput } from "./trading-types";

export interface ParsedCsv {
  trades: TradeInput[];
  transactions: CashInput[];
  errors: string[];
}

/** Case-insensitive header candidates for MT5 exports (and our template). */
const HEADER_CANDIDATES: Record<string, string[]> = {
  symbol: ["symbol"],
  type: ["type", "side", "direction"],
  volume: ["volume", "lots", "lot", "size"],
  openPrice: ["openprice", "open price", "priceopen", "price open"],
  closePrice: ["closeprice", "close price", "priceclose", "price close"],
  sl: ["sl", "s/l", "stoploss", "stop loss"],
  tp: ["tp", "t/p", "takeprofit", "take profit"],
  commission: ["commission", "comm"],
  swap: ["swap"],
  profit: ["profit", "pnl", "p/l"],
  openTime: ["opentime", "open time", "timeopen", "time open", "time"],
  closeTime: ["closetime", "close time", "timeclose", "time close"],
  comment: ["comment", "comments", "note", "notes"],
};

const CASH_TYPE_KEYWORDS = ["balance", "deposit", "withdraw", "withdrawal", "credit"];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\-]+/g, " ");
}

/** Map actual CSV headers to our canonical field names. */
function buildHeaderMap(fields: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) {
    const normalized = normalizeHeader(field);
    for (const [canonical, candidates] of Object.entries(HEADER_CANDIDATES)) {
      if (map[canonical]) continue;
      if (candidates.includes(normalized) || candidates.includes(normalized.replace(/\s+/g, ""))) {
        map[canonical] = field;
        break;
      }
    }
  }
  return map;
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const cleaned = String(value).replace(/[\s,$]/g, "");
  if (cleaned === "") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateIso(value: unknown): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  // MT5 uses "2026.07.01 07:01:02" or "2026-07-01 07:01"
  const normalized = raw.replace(/\./g, "-").replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function parseMt5Csv(csvText: string): ParsedCsv {
  const trades: TradeInput[] = [];
  const transactions: CashInput[] = [];
  const errors: string[] = [];

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
  });

  for (const err of result.errors) {
    if (err.code !== "TooFewFields" && err.code !== "TooManyFields") {
      errors.push(`Row ${err.row != null ? err.row + 2 : "?"}: ${err.message}`);
    }
  }

  const headerMap = buildHeaderMap(result.meta.fields ?? []);
  if (!headerMap.type && !headerMap.symbol) {
    return {
      trades,
      transactions,
      errors: ["Could not find Symbol/Type columns — is this an MT5 CSV export?"],
    };
  }

  const get = (row: Record<string, string>, key: string): string =>
    headerMap[key] ? String(row[headerMap[key]] ?? "").trim() : "";

  result.data.forEach((row, index) => {
    const line = index + 2; // 1-based + header row
    const symbol = get(row, "symbol").toUpperCase();
    const typeRaw = get(row, "type").toLowerCase();
    const profit = num(get(row, "profit"));
    const comment = get(row, "comment") || undefined;

    const isCashRow =
      CASH_TYPE_KEYWORDS.some((kw) => typeRaw.includes(kw)) || (!symbol && profit !== undefined);

    if (isCashRow) {
      if (profit === undefined || profit === 0) {
        errors.push(`Row ${line}: balance row without an amount — skipped.`);
        return;
      }
      const explicitWithdrawal =
        typeRaw.includes("withdraw") || (comment ?? "").toLowerCase().includes("withdraw");
      transactions.push({
        type: explicitWithdrawal || profit < 0 ? "withdrawal" : "deposit",
        amount: Math.abs(profit),
        date: dateIso(get(row, "openTime")) ?? dateIso(get(row, "closeTime")) ?? new Date().toISOString(),
        note: comment,
      });
      return;
    }

    const side = typeRaw.includes("sell") ? "sell" : typeRaw.includes("buy") ? "buy" : null;
    if (!symbol || !side) {
      errors.push(`Row ${line}: unrecognized trade (symbol="${symbol}", type="${typeRaw}") — skipped.`);
      return;
    }

    trades.push({
      symbol,
      side,
      lots: num(get(row, "volume")) ?? 0,
      openPrice: num(get(row, "openPrice")),
      closePrice: num(get(row, "closePrice")),
      sl: num(get(row, "sl")),
      tp: num(get(row, "tp")),
      commission: num(get(row, "commission")) ?? 0,
      swap: num(get(row, "swap")) ?? 0,
      profit,
      openTime: dateIso(get(row, "openTime")),
      closeTime: dateIso(get(row, "closeTime")),
      notes: comment,
    });
  });

  return { trades, transactions, errors };
}

export const CSV_TEMPLATE = `Symbol,Type,Volume,OpenPrice,ClosePrice,Commission,Swap,Profit,OpenTime,CloseTime,Comment
XAUUSD,buy,0.10,4020.50,4035.00,-0.70,0,145.00,2026-07-01 07:01,2026-07-01 09:30,แม่ปลา breakout
XAUUSD,sell,0.10,4066.00,4050.00,-0.70,-1.20,158.80,2026-07-02 14:00,2026-07-02 16:45,Sig ยักษ์ H4
,balance,,,,,,3000.00,2026-06-01 00:00,,Deposit initial
`;

export function downloadCsvTemplate(): void {
  const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "trading-journal-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
