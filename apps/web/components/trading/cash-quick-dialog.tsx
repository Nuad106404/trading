"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { CashInput, CashType } from "@/lib/trading-types";
import { invalidateTradingScopes } from "@/lib/use-trading-events";

/** One-tap deposit / withdrawal entry, used from the trading dashboard. */
export function CashQuickDialog({
  type,
  open,
  onOpenChange,
}: {
  type: CashType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: (input: CashInput) => api("/trading/cash", { method: "POST", body: input }),
    onSuccess: () => {
      toast.success(type === "deposit" ? t("cash.depositTitle") : t("cash.withdrawTitle"));
      setAmount("");
      setNote("");
      onOpenChange(false);
      invalidateTradingScopes(queryClient, ["cash", "stats"]);
    },
    onError: (err) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.info("You're offline — saved locally and will sync when you're back online.");
        onOpenChange(false);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }
    mutation.mutate({
      type,
      amount: parsed,
      date: new Date().toISOString(),
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === "deposit" ? t("cash.depositTitle") : t("cash.withdrawTitle")}
          </DialogTitle>
          <DialogDescription>{t("cash.quickDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="qc-amount">{t("cash.amountUsd")}</Label>
            <Input
              id="qc-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              inputMode="decimal"
              className="font-mono text-lg"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="qc-note">{t("common.note")}</Label>
            <Input id="qc-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              variant={type === "withdrawal" ? "destructive" : "default"}
            >
              {mutation.isPending
                ? t("common.saving")
                : type === "deposit"
                  ? t("trading.deposit")
                  : t("trading.withdraw")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
