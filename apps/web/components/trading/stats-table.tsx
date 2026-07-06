"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtPercent, fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { TradingSummary } from "@/lib/trading-types";
import { cn } from "@/lib/utils";

export function StatsTable({ summary }: { summary?: TradingSummary }) {
  const { t } = useI18n();
  const s = summary;
  const rows: { label: string; value: string; className?: string }[] = [
    { label: t("stats.totalTrades"), value: s ? String(s.totalTrades) : "—" },
    { label: t("stats.winsLosses"), value: s ? `${s.wins} / ${s.losses}` : "—" },
    { label: t("trading.winrate"), value: s ? fmtPercent(s.winrate) : "—" },
    {
      label: t("trading.profitFactor"),
      value: s ? (s.profitFactor === null ? "∞" : s.profitFactor.toFixed(2)) : "—",
    },
    { label: t("stats.avgWin"), value: s ? fmtSignedMoney(s.avgWin) : "—", className: "text-emerald-400" },
    { label: t("stats.avgLoss"), value: s ? fmtSignedMoney(s.avgLoss) : "—", className: "text-red-400" },
    { label: t("stats.rr"), value: s ? s.rr.toFixed(2) : "—" },
    { label: t("stats.expectancy"), value: s ? fmtSignedMoney(s.expectancy) : "—", className: s ? pnlClass(s.expectancy) : undefined },
    { label: t("stats.maxWinStreak"), value: s ? String(s.maxWinStreak) : "—", className: "text-emerald-400" },
    { label: t("stats.maxLossStreak"), value: s ? String(s.maxLossStreak) : "—", className: "text-red-400" },
    { label: t("stats.largestWin"), value: s ? fmtSignedMoney(s.largestWin) : "—", className: "text-emerald-400" },
    { label: t("stats.largestLoss"), value: s ? fmtSignedMoney(s.largestLoss) : "—", className: "text-red-400" },
    { label: t("stats.totalLots"), value: s ? s.totalLots.toFixed(2) : "—" },
    { label: t("stats.commission"), value: s ? fmtSignedMoney(s.totalCommission) : "—" },
    { label: t("stats.swap"), value: s ? fmtSignedMoney(s.totalSwap) : "—" },
    { label: t("stats.deposits"), value: s ? fmtMoney(s.deposits) : "—" },
    { label: t("stats.withdrawals"), value: s ? fmtMoney(s.withdrawals) : "—" },
    { label: t("trading.netPnl"), value: s ? fmtSignedMoney(s.netProfit) : "—", className: s ? pnlClass(s.netProfit) : undefined },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("trading.statistics")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 pt-0 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2 border-b border-border/50 py-1.5">
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span className={cn("font-mono text-sm", row.className)}>{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
