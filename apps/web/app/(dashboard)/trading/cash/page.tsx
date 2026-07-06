"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BulkBar, RowCheckbox } from "@/components/bulk-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select } from "@/components/ui/select";
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
import type { CashInput, CashTransaction, CashType } from "@/lib/trading-types";
import { formatDate } from "@/lib/utils";

export default function CashPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [type, setType] = useState<CashType>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState<CashTransaction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const cashQuery = useQuery({
    queryKey: ["trading", "cash"],
    queryFn: () => api<CashTransaction[]>("/trading/cash"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["trading"] });

  const createMutation = useMutation({
    mutationFn: (input: CashInput) => api("/trading/cash", { method: "POST", body: input }),
    onSuccess: () => {
      toast.success("Transaction recorded.");
      setAmount("");
      setNote("");
      void invalidate();
    },
    onError: (err) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        toast.info("You're offline — saved locally and will sync when you're back online.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to record transaction.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/trading/cash/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Transaction deleted.");
      setDeleting(null);
      void invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction."),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number }>("/trading/cash/bulk-delete", { method: "POST", body: { ids } }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} transaction${result.deleted === 1 ? "" : "s"} deleted.`);
      setSelected(new Set());
      setBulkConfirm(false);
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete."),
  });

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }
    createMutation.mutate({
      type,
      amount: parsed,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      note: note.trim() || undefined,
    });
  };

  const transactions = cashQuery.data ?? [];
  const deposits = transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-4 sm:gap-6">
      <h1 className="text-xl font-semibold sm:text-2xl">
        {t("cash.title1")} <span className="text-amber-400">{t("cash.title2")}</span>
      </h1>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              {t("stats.deposits")}
            </p>
            <p className="mt-1 truncate font-mono text-base font-semibold text-emerald-400 sm:text-lg">
              {fmtMoney(deposits)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              {t("stats.withdrawals")}
            </p>
            <p className="mt-1 truncate font-mono text-base font-semibold text-red-400 sm:text-lg">
              {fmtMoney(withdrawals)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              {t("cash.net")}
            </p>
            <p className="mt-1 truncate font-mono text-base font-semibold text-amber-400 sm:text-lg">
              {fmtMoney(deposits - withdrawals)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("cash.recordTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cash-type" className="text-xs text-muted-foreground">
                {t("common.type")}
              </Label>
              <Select
                id="cash-type"
                className="w-32 sm:w-36"
                value={type}
                onChange={(e) => setType(e.target.value as CashType)}
              >
                <option value="deposit">{t("cash.deposit")}</option>
                <option value="withdrawal">{t("cash.withdrawal")}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cash-amount" className="text-xs text-muted-foreground">
                {t("cash.amountUsd")}
              </Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                inputMode="decimal"
                className="w-32 font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cash-date" className="text-xs text-muted-foreground">
                {t("common.date")}
              </Label>
              <Input
                id="cash-date"
                type="datetime-local"
                className="w-52"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <Label htmlFor="cash-note" className="text-xs text-muted-foreground">
                {t("common.note")}
              </Label>
              <Input id="cash-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("common.saving") : t("common.add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="destructive" size="sm" onClick={() => setBulkConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          </BulkBar>
          {cashQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("chrome.loading")}</p>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("cash.noTransactions")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <RowCheckbox
                      checked={transactions.length > 0 && transactions.every((tx) => selected.has(tx.id))}
                      onChange={() =>
                        setSelected(
                          transactions.every((tx) => selected.has(tx.id))
                            ? new Set()
                            : new Set(transactions.map((tx) => tx.id)),
                        )
                      }
                      label="Select all"
                    />
                  </TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.note")}</TableHead>
                  <TableHead>{t("common.source")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <RowCheckbox checked={selected.has(tx.id)} onChange={() => toggleRow(tx.id)} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "deposit" ? "success" : "destructive"} className="gap-1">
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
                    <TableCell className="max-w-52 truncate text-muted-foreground">
                      {tx.note || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{tx.source}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(tx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bulk.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {selected.size} — {t("bulk.deleteDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBulkConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate([...selected])}
            >
              {bulkDeleteMutation.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cash.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {deleting && (deleting.type === "deposit" ? t("cash.deposit") : t("cash.withdrawal"))}{" "}
              {fmtMoney(deleting?.amount)} · {deleting ? formatDate(deleting.date) : ""} —{" "}
              {t("common.cannotUndo")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
