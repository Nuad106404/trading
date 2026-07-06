"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ListPlus,
  Upload,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CashQuickDialog } from "@/components/trading/cash-quick-dialog";
import { EquityChart } from "@/components/trading/equity-chart";
import { MonthlyChart } from "@/components/trading/monthly-chart";
import { StatsTable } from "@/components/trading/stats-table";
import { SummaryTicker } from "@/components/trading/summary-ticker";
import { SymbolStats } from "@/components/trading/symbol-stats";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/trading";
import type {
  CashTransaction,
  CashType,
  Drawdown,
  EquityPoint,
  MonthlyPnl,
  SymbolStat,
  TradingSummary,
} from "@/lib/trading-types";
import { formatDate } from "@/lib/utils";

export default function TradingDashboardPage() {
  const { t } = useI18n();
  const [quickCash, setQuickCash] = useState<CashType | null>(null);

  const summary = useQuery({
    queryKey: ["trading", "summary"],
    queryFn: () => api<TradingSummary>("/trading/stats/summary"),
  });
  const equity = useQuery({
    queryKey: ["trading", "equity-curve"],
    queryFn: () => api<EquityPoint[]>("/trading/stats/equity-curve"),
  });
  const monthly = useQuery({
    queryKey: ["trading", "monthly"],
    queryFn: () => api<MonthlyPnl[]>("/trading/stats/monthly"),
  });
  const bySymbol = useQuery({
    queryKey: ["trading", "by-symbol"],
    queryFn: () => api<SymbolStat[]>("/trading/stats/by-symbol"),
  });
  const drawdown = useQuery({
    queryKey: ["trading", "max-drawdown"],
    queryFn: () => api<Drawdown>("/trading/stats/max-drawdown"),
  });
  const cash = useQuery({
    queryKey: ["trading", "cash"],
    queryFn: () => api<CashTransaction[]>("/trading/cash"),
  });

  const isOffline =
    summary.isError && typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {t("trading.title1")} <span className="text-amber-400">{t("trading.title2")}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuickCash("deposit")}>
            <ArrowDownToLine className="h-4 w-4 text-emerald-400" />
            {t("trading.deposit")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQuickCash("withdrawal")}>
            <ArrowUpFromLine className="h-4 w-4 text-red-400" />
            {t("trading.withdraw")}
          </Button>
          <Link
            href="/trading/trades"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ListPlus className="h-4 w-4" />
            {t("nav.trades")}
          </Link>
          <Link href="/trading/import" className={buttonVariants({ size: "sm" })}>
            <Upload className="h-4 w-4" />
            {t("nav.import")}
          </Link>
        </div>
      </div>

      {isOffline && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4" />
            {t("common.offline")}
          </CardContent>
        </Card>
      )}

      <SummaryTicker summary={summary.data} drawdown={drawdown.data} />

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <EquityChart data={equity.data} />
        <MonthlyChart data={monthly.data} />
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <SymbolStats data={bySymbol.data} />
        <StatsTable summary={summary.data} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("trading.cashRecent")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {cash.data && cash.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cash.data.slice(0, 8).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge
                        variant={tx.type === "deposit" ? "success" : "destructive"}
                        className="gap-1"
                      >
                        {tx.type === "deposit" ? (
                          <ArrowDownToLine className="h-3 w-3" />
                        ) : (
                          <ArrowUpFromLine className="h-3 w-3" />
                        )}
                        {tx.type === "deposit" ? t("cash.deposit") : t("cash.withdrawal")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {tx.type === "deposit" ? "+" : "-"}
                      {fmtMoney(tx.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {tx.note || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("trading.noCash")}
            </p>
          )}
        </CardContent>
      </Card>

      <CashQuickDialog
        type={quickCash ?? "deposit"}
        open={quickCash !== null}
        onOpenChange={(open) => !open && setQuickCash(null)}
      />
    </div>
  );
}
