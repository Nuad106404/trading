"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtPercent, fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { Drawdown, TradingSummary } from "@/lib/trading-types";
import { cn } from "@/lib/utils";

export function SummaryTicker({
  summary,
  drawdown,
}: {
  summary?: TradingSummary;
  drawdown?: Drawdown;
}) {
  const { t } = useI18n();
  const items: { label: string; value: string; className?: string }[] = [
    {
      label: t("trading.balance"),
      value: fmtMoney(summary?.balance),
      className: "text-amber-400",
    },
    {
      label: t("trading.netPnl"),
      value: fmtSignedMoney(summary?.netProfit),
      className: pnlClass(summary?.netProfit),
    },
    {
      label: t("trading.winrate"),
      value: summary ? fmtPercent(summary.winrate) : "—",
      className: "text-foreground",
    },
    {
      label: t("trading.profitFactor"),
      value: summary ? (summary.profitFactor === null ? "∞" : summary.profitFactor.toFixed(2)) : "—",
      className: "text-foreground",
    },
    {
      label: t("trading.maxDrawdown"),
      value: drawdown ? `${fmtMoney(drawdown.amount)} (${fmtPercent(drawdown.percent)})` : "—",
      className: "text-red-400",
    },
    {
      label: t("trading.trades"),
      value: summary ? `${summary.totalTrades}` : "—",
      className: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="border-amber-500/10">
          <CardContent className="p-3 sm:p-4">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              {item.label}
            </p>
            <p className={cn("mt-1 truncate font-mono text-base font-semibold sm:text-lg", item.className)}>
              {item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
