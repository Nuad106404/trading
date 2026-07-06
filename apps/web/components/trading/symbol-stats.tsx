"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtPercent, fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { SymbolStat } from "@/lib/trading-types";
import { cn } from "@/lib/utils";

export function SymbolStats({ data }: { data?: SymbolStat[] }) {
  const { t } = useI18n();
  const rows = data ?? [];
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.netProfit)));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("trading.bySymbol")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("trading.noTrades")}</p>
        ) : (
          rows.map((row) => (
            <div key={row.symbol} className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-mono text-sm font-semibold text-amber-400">
                {row.symbol}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full",
                    row.netProfit >= 0 ? "bg-emerald-400" : "bg-red-400",
                  )}
                  style={{ width: `${Math.max(4, (Math.abs(row.netProfit) / maxAbs) * 100)}%` }}
                />
              </div>
              <span className={cn("w-24 shrink-0 text-right font-mono text-sm", pnlClass(row.netProfit))}>
                {fmtSignedMoney(row.netProfit)}
              </span>
              <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
                {row.count} trades · {fmtPercent(row.winrate, 0)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
