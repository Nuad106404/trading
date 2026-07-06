export type TradeSide = "buy" | "sell";
export type TradingSource = "manual" | "import";
export type CashType = "deposit" | "withdrawal";

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  ticket?: string;
  side: TradeSide;
  lots: number;
  openPrice?: number;
  closePrice?: number;
  sl?: number;
  tp?: number;
  openTime?: string;
  closeTime?: string;
  commission: number;
  swap: number;
  profit: number;
  netProfit: number;
  tags?: string[];
  notes?: string;
  source: TradingSource;
  createdAt: string;
  updatedAt: string;
}

export interface TradeInput {
  symbol: string;
  ticket?: string;
  side: TradeSide;
  lots: number;
  openPrice?: number;
  closePrice?: number;
  sl?: number;
  tp?: number;
  openTime?: string;
  closeTime?: string;
  commission?: number;
  swap?: number;
  profit?: number;
  tags?: string[];
  notes?: string;
}

export interface CashTransaction {
  id: string;
  userId: string;
  type: CashType;
  amount: number;
  date: string;
  note?: string;
  source: TradingSource;
  createdAt: string;
  updatedAt: string;
}

export interface CashInput {
  type: CashType;
  amount: number;
  date: string;
  note?: string;
}

export interface TradingSummary {
  balance: number;
  netProfit: number;
  winrate: number;
  profitFactor: number | null; // null = no losses yet (∞)
  avgWin: number;
  avgLoss: number;
  rr: number;
  totalTrades: number;
  wins: number;
  losses: number;
  maxWinStreak: number;
  maxLossStreak: number;
  totalCommission: number;
  totalSwap: number;
  deposits: number;
  withdrawals: number;
  totalLots: number;
  largestWin: number;
  largestLoss: number;
  expectancy: number;
}

export interface EquityPoint {
  ts: string | null;
  balance: number;
  type: "trade" | "deposit" | "withdrawal";
  delta: number;
}

export interface MonthlyPnl {
  month: string;
  netProfit: number;
  count: number;
}

export interface SymbolStat {
  symbol: string;
  netProfit: number;
  count: number;
  winrate: number;
}

export interface Drawdown {
  amount: number;
  percent: number;
  peakAt: string | null;
  troughAt: string | null;
}

export interface AdminTradingRow {
  userId: string;
  username: string;
  totalTrades: number;
  netProfit: number;
  balance: number;
  lastTradeAt: string | null;
}
