"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/trading";
import type { EquityPoint } from "@/lib/trading-types";

export function EquityChart({ data, title }: { data?: EquityPoint[]; title?: string }) {
  const { t } = useI18n();
  const points = (data ?? []).map((p, i) => ({
    index: i + 1,
    balance: p.balance,
    label: p.ts ? new Date(p.ts).toLocaleDateString() : `#${i + 1}`,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title ?? t("trading.equityCurve")}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-60 p-2 pt-0 sm:h-72">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {t("trading.noCurveData")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="equityGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8b93a1", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "#8b93a1", fontSize: 11, fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={70}
                tickFormatter={(v: number) => fmtMoney(v, 0)}
              />
              <Tooltip
                contentStyle={{
                  background: "#12151a",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#8b93a1" }}
                formatter={(value) => [fmtMoney(Number(value)), "Balance"]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#equityGold)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
