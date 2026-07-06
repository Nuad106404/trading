"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminUserJournal } from "@/components/trading/admin-user-journal";
import { EquityChart } from "@/components/trading/equity-chart";
import { StatsTable } from "@/components/trading/stats-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { AdminTradingRow, EquityPoint, TradingSummary } from "@/lib/trading-types";
import { cn, formatDate } from "@/lib/utils";

export default function AdminTradingOverviewPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<AdminTradingRow | null>(null);

  useEffect(() => {
    if (!loading && user && user.role === "user") router.replace("/profile");
  }, [loading, user, router]);

  const overview = useQuery({
    queryKey: ["trading", "admin-overview"],
    queryFn: () => api<AdminTradingRow[]>("/trading/admin/overview"),
    enabled: !!user && user.role !== "user",
  });

  const detailSummary = useQuery({
    queryKey: ["trading", "admin-user-summary", selected?.userId],
    queryFn: () => api<TradingSummary>(`/trading/admin/users/${selected!.userId}/summary`),
    enabled: !!selected,
  });

  const detailEquity = useQuery({
    queryKey: ["trading", "admin-user-equity", selected?.userId],
    queryFn: () => api<EquityPoint[]>(`/trading/admin/users/${selected!.userId}/equity-curve`),
    enabled: !!selected,
  });

  if (loading || !user || user.role === "user") return null;

  const rows = overview.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {t("admin.overview.title1")}{" "}
          <span className="text-amber-400">{t("admin.overview.title2")}</span>
        </h1>
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          {t("admin.overview.badge")}
        </Badge>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground sm:-mt-4">{t("admin.overview.desc")}</p>

      <Card>
        <CardContent className="p-4">
          {overview.isPending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading overview…</p>
          ) : overview.isError ? (
            <p className="py-10 text-center text-sm text-destructive">
              {overview.error instanceof Error ? overview.error.message : "Failed to load."}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("admin.overview.noActivity")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.overview.user")}</TableHead>
                  <TableHead>{t("trading.trades")}</TableHead>
                  <TableHead>{t("trading.netPnl")}</TableHead>
                  <TableHead>{t("trading.balance")}</TableHead>
                  <TableHead>{t("admin.overview.lastTrade")}</TableHead>
                  <TableHead className="text-right">{t("admin.overview.detail")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.userId}
                    className={cn(
                      "cursor-pointer",
                      selected?.userId === row.userId && "bg-secondary/60",
                    )}
                    onClick={() =>
                      setSelected((cur) => (cur?.userId === row.userId ? null : row))
                    }
                  >
                    <TableCell className="font-medium">{row.username}</TableCell>
                    <TableCell className="font-mono">{row.totalTrades}</TableCell>
                    <TableCell className={cn("font-mono font-semibold", pnlClass(row.netProfit))}>
                      {fmtSignedMoney(row.netProfit)}
                    </TableCell>
                    <TableCell className="font-mono text-amber-400">
                      {fmtMoney(row.balance)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.lastTradeAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="View summary">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selected.username}</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" />
              {t("common.close")}
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <EquityChart data={detailEquity.data} title={`Equity curve — ${selected.username}`} />
            <StatsTable summary={detailSummary.data} />
          </div>
          <AdminUserJournal userId={selected.userId} username={selected.username} />
        </div>
      )}
    </div>
  );
}
