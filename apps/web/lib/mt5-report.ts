import type { CashInput, TradeInput } from "./trading-types";
import type { ParsedCsv } from "./mt5-csv";

/**
 * Parser for MT5's "Trade History Report" export (Reports → Export → Open XML,
 * a .xlsx file). Layout: metadata rows, then three sections each introduced by
 * a title row in column A:
 *
 *   Positions  — closed positions (this is what we import as trades)
 *   Orders     — order log (skipped)
 *   Deals      — raw fills + `balance` rows (imported as cash transactions)
 *
 * Kept dependency-free (rows in, ParsedCsv out) so it can be unit-tested in
 * Node; the workbook is decoded separately in parseMt5ReportXlsx().
 */

type Row = unknown[];

function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const cleaned = String(value).replace(/[\s,$]/g, "");
  if (cleaned === "") return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateIso(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30), interpreted as UTC
    const ms = Math.round((value - 25569) * 86_400_000);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const raw = String(value).trim();
  if (!raw) return undefined;
  // MT5 report format: "2026.07.02 12:30:29"
  const normalized = raw.replace(/\./g, "-").replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** header cell → canonical key ("S / L" → "s/l") */
function normalizeHeader(value: unknown): string {
  return cellStr(value).toLowerCase().replace(/\s+/g, "");
}

/** column indexes per header name, in order of appearance (Time/Price repeat) */
function buildHeaderIndex(row: Row): Map<string, number[]> {
  const map = new Map<string, number[]>();
  row.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(index);
    map.set(key, list);
  });
  return map;
}

export function parseMt5ReportRows(rows: Row[]): ParsedCsv {
  const trades: TradeInput[] = [];
  const transactions: CashInput[] = [];
  const errors: string[] = [];

  let section: "none" | "positions" | "deals" = "none";
  let header: Map<string, number[]> | null = null;

  const col = (name: string, occurrence = 0): number =>
    header?.get(name)?.[occurrence] ?? -1;
  const cell = (row: Row, name: string, occurrence = 0): unknown => {
    const index = col(name, occurrence);
    return index >= 0 ? row[index] : undefined;
  };

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const first = cellStr(row[0]).toLowerCase();

    if (first === "positions") {
      section = "positions";
      header = null;
      continue;
    }
    if (first === "orders" || first === "results" || first.startsWith("balance:")) {
      section = "none";
      continue;
    }
    if (first === "deals") {
      section = "deals";
      header = null;
      continue;
    }
    if (section === "none") continue;

    // first row after a section title is its column header
    if (!header) {
      header = buildHeaderIndex(row);
      continue;
    }

    const line = r + 1;

    if (section === "positions") {
      const symbol = cellStr(cell(row, "symbol")).toUpperCase();
      const sideRaw = cellStr(cell(row, "type")).toLowerCase();
      const side = sideRaw === "buy" ? "buy" : sideRaw === "sell" ? "sell" : null;
      if (!symbol || !side) {
        // totals / blank separator rows are expected — only flag odd non-empty rows
        if (symbol || sideRaw) errors.push(`Row ${line}: unrecognized position row — skipped.`);
        continue;
      }
      trades.push({
        symbol,
        ticket: cellStr(cell(row, "position")) || undefined,
        side,
        lots: num(cell(row, "volume")) ?? 0,
        openPrice: num(cell(row, "price", 0)),
        closePrice: num(cell(row, "price", 1)),
        sl: num(cell(row, "s/l")),
        tp: num(cell(row, "t/p")),
        openTime: dateIso(cell(row, "time", 0)),
        closeTime: dateIso(cell(row, "time", 1)),
        commission: num(cell(row, "commission")) ?? 0,
        swap: num(cell(row, "swap")) ?? 0,
        profit: num(cell(row, "profit")),
      });
      continue;
    }

    // deals section — only balance-style rows matter (deposits/withdrawals);
    // regular fills are already aggregated in the Positions table
    const dealType = cellStr(cell(row, "type")).toLowerCase();
    if (!["balance", "credit", "deposit", "withdrawal"].includes(dealType)) continue;

    const amount = num(cell(row, "profit"));
    if (amount === undefined || amount === 0) {
      errors.push(`Row ${line}: balance row without an amount — skipped.`);
      continue;
    }
    const comment = cellStr(cell(row, "comment"));
    const explicitWithdrawal =
      dealType === "withdrawal" || comment.toLowerCase().startsWith("w-");
    transactions.push({
      type: explicitWithdrawal || amount < 0 ? "withdrawal" : "deposit",
      amount: Math.abs(amount),
      date: dateIso(cell(row, "time")) ?? new Date().toISOString(),
      note: comment || undefined,
    });
  }

  if (trades.length === 0 && transactions.length === 0) {
    errors.push(
      "No Positions/Deals sections found — export the report from MT5 via right-click → Report → Open XML (Excel).",
    );
  }

  return { trades, transactions, errors };
}

/** Browser entry point: decode the workbook, then run the row parser. */
export async function parseMt5ReportXlsx(data: ArrayBuffer): Promise<ParsedCsv> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { trades: [], transactions: [], errors: ["Workbook has no sheets."] };
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][];
  return parseMt5ReportRows(rows);
}
