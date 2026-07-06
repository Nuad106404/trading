"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { computeGrossProfit, fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { Trade, TradeInput, TradeSide } from "@/lib/trading-types";
import { cn } from "@/lib/utils";

interface FormState {
  symbol: string;
  side: TradeSide;
  lots: string;
  openPrice: string;
  closePrice: string;
  sl: string;
  tp: string;
  openTime: string;
  closeTime: string;
  commission: string;
  swap: string;
  profit: string;
  tags: string;
  notes: string;
}

const EMPTY: FormState = {
  symbol: "XAUUSD",
  side: "buy",
  lots: "0.10",
  openPrice: "",
  closePrice: "",
  sl: "",
  tp: "",
  openTime: "",
  closeTime: "",
  commission: "",
  swap: "",
  profit: "",
  tags: "",
  notes: "",
};

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function numOrUndef(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function TradeForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
}: {
  initial?: Trade | null;
  pending: boolean;
  submitLabel: string;
  onSubmit: (input: TradeInput) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!initial) {
      setForm(EMPTY);
      return;
    }
    setForm({
      symbol: initial.symbol,
      side: initial.side,
      lots: String(initial.lots),
      openPrice: initial.openPrice != null ? String(initial.openPrice) : "",
      closePrice: initial.closePrice != null ? String(initial.closePrice) : "",
      sl: initial.sl != null ? String(initial.sl) : "",
      tp: initial.tp != null ? String(initial.tp) : "",
      openTime: toLocalInput(initial.openTime),
      closeTime: toLocalInput(initial.closeTime),
      commission: String(initial.commission ?? 0),
      swap: String(initial.swap ?? 0),
      profit: String(initial.profit ?? ""),
      tags: (initial.tags ?? []).join(", "),
      notes: initial.notes ?? "",
    });
  }, [initial]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // live preview of the auto-derived profit (same formula as the backend)
  const autoProfit = useMemo(() => {
    if (form.profit.trim() !== "") return null;
    const open = numOrUndef(form.openPrice);
    const close = numOrUndef(form.closePrice);
    const lots = numOrUndef(form.lots);
    if (open == null || close == null || lots == null) return null;
    return computeGrossProfit(form.side, open, close, lots);
  }, [form.profit, form.openPrice, form.closePrice, form.lots, form.side]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input: TradeInput = {
      symbol: form.symbol.trim().toUpperCase(),
      side: form.side,
      lots: numOrUndef(form.lots) ?? 0,
      openPrice: numOrUndef(form.openPrice),
      closePrice: numOrUndef(form.closePrice),
      sl: numOrUndef(form.sl),
      tp: numOrUndef(form.tp),
      openTime: form.openTime ? new Date(form.openTime).toISOString() : undefined,
      closeTime: form.closeTime ? new Date(form.closeTime).toISOString() : undefined,
      commission: numOrUndef(form.commission),
      swap: numOrUndef(form.swap),
      // blank profit → send the previewed auto-derived value (same formula as
      // the backend) so edits recalculate instead of keeping the old profit
      profit: numOrUndef(form.profit) ?? autoProfit ?? undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
    };
    onSubmit(input);
  };

  const field = (
    key: keyof FormState,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`tf-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`tf-${key}`} value={form[key]} onChange={set(key)} {...props} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("symbol", t("trades.symbol"), { required: true, className: "font-mono uppercase" })}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tf-side" className="text-xs text-muted-foreground">
            {t("trades.side")}
          </Label>
          <Select id="tf-side" value={form.side} onChange={set("side")}>
            <option value="buy">buy</option>
            <option value="sell">sell</option>
          </Select>
        </div>
        {field("lots", t("trades.lots"), { type: "number", step: "0.01", min: "0", required: true, className: "font-mono", inputMode: "decimal" })}
        {field("profit", t("form.profitAuto"), { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
        {field("openPrice", t("form.openPrice"), { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
        {field("closePrice", t("form.closePrice"), { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
        {field("sl", "SL", { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
        {field("tp", "TP", { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
        {field("openTime", t("form.openTime"), { type: "datetime-local" })}
        {field("closeTime", t("form.closeTime"), { type: "datetime-local" })}
        {field("commission", t("stats.commission"), { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
        {field("swap", t("stats.swap"), { type: "number", step: "0.01", className: "font-mono", inputMode: "decimal" })}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field("tags", t("form.tags"), { placeholder: "แม่ปลา, breakout" })}
        {field("notes", t("form.notes"))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {autoProfit !== null ? (
          <p className="text-sm text-muted-foreground">
            {t("form.autoProfit")}{" "}
            <span className={cn("font-mono", pnlClass(autoProfit))}>{fmtSignedMoney(autoProfit)}</span>
            <span className="ml-1 text-xs">{t("form.grossFromPrices")}</span>
          </p>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
