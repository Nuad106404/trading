"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtMoney, fmtSignedMoney } from "@/lib/trading";
import type { MonthlyPnl } from "@/lib/trading-types";

export function MonthlyChart({ data }: { data?: MonthlyPnl[] }) {
  const { t } = useI18n();
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("trading.monthlyPnl")}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-60 p-2 pt-0 sm:h-72">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("trading.noClosedTrades")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#8b93a1", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                tick={{ fill: "#8b93a1", fontSize: 11, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={70}
                tickFormatter={(v: number) => fmtMoney(v, 0)}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#12151a",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#8b93a1" }}
                formatter={(value) => [fmtSignedMoney(Number(value)), "Net P&L"]}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar dataKey="netProfit" radius={[3, 3, 0, 0]}>
                {rows.map((row) => (
                  <Cell key={row.month} fill={row.netProfit >= 0 ? "#34d399" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
