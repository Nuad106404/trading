"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BulkBar, RowCheckbox } from "@/components/bulk-bar";
import { TradeForm } from "@/components/trading/trade-form";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { fmtMoney, fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { CashTransaction, Trade, TradeInput } from "@/lib/trading-types";
import type { Paginated } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * Admin management of one user's journal entries. The backend enforces the
 * role rules (admins may only modify user-role journals); failures surface
 * as toasts here.
 */
export function AdminUserJournal({ userId, username }: { userId: string; username: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 10;
  const [editing, setEditing] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState<Trade | null>(null);
  const [deletingCash, setDeletingCash] = useState<CashTransaction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const base = `/trading/admin/users/${userId}`;

  const tradesQuery = useQuery({
    queryKey: ["trading", "admin-user-trades", userId, page],
    queryFn: () =>
      api<Paginated<Trade>>(`${base}/trades?page=${page}&limit=${limit}&sortBy=closeTime&sortOrder=desc`),
  });

  const cashQuery = useQuery({
    queryKey: ["trading", "admin-user-cash", userId],
    queryFn: () => api<CashTransaction[]>(`${base}/cash`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["trading"] });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TradeInput }) =>
      api<Trade>(`${base}/trades/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success(`Trade updated in ${username}'s journal.`);
      setEditing(null);
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update trade."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`${base}/trades/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`Trade deleted from ${username}'s journal.`);
      setDeleting(null);
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete trade."),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number }>(`${base}/trades/bulk-delete`, { method: "POST", body: { ids } }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} trade${result.deleted === 1 ? "" : "s"} deleted from ${username}'s journal.`);
      setSelected(new Set());
      setBulkConfirm(false);
      void invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete trades."),
  });

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteCashMutation = useMutation({
    mutationFn: (id: string) => api(`${base}/cash/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`Transaction deleted from ${username}'s journal.`);
      setDeletingCash(null);
      void invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction."),
  });

  const data = tradesQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const transactions = cashQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Trades — {username}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="destructive" size="sm" onClick={() => setBulkConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
          </BulkBar>
          {tradesQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading trades…</p>
          ) : tradesQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              {tradesQuery.error instanceof Error ? tradesQuery.error.message : "Failed to load."}
            </p>
          ) : data && data.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No trades recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <RowCheckbox
                      checked={
                        (data?.data.length ?? 0) > 0 &&
                        (data?.data ?? []).every((trade) => selected.has(trade.id))
                      }
                      onChange={() =>
                        setSelected(
                          (data?.data ?? []).every((trade) => selected.has(trade.id))
                            ? new Set()
                            : new Set((data?.data ?? []).map((trade) => trade.id)),
                        )
                      }
                      label="Select all"
                    />
                  </TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Lots</TableHead>
                  <TableHead>Net P&L</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <RowCheckbox checked={selected.has(trade.id)} onChange={() => toggleRow(trade.id)} />
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-amber-400">
                      {trade.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trade.side === "buy" ? "success" : "destructive"}>
                        {trade.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{trade.lots.toFixed(2)}</TableCell>
                    <TableCell className={cn("font-mono font-semibold", pnlClass(trade.netProfit))}>
                      {fmtSignedMoney(trade.netProfit)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(trade.closeTime)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{trade.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => setEditing(trade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(trade)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {data && data.total > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Page {data.page} of {totalPages} · {data.total} trade{data.total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cash flow — {username}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {cashQuery.isPending ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant={tx.type === "deposit" ? "success" : "destructive"} className="gap-1">
                        {tx.type === "deposit" ? (
                          <ArrowDownToLine className="h-3 w-3" />
                        ) : (
                          <ArrowUpFromLine className="h-3 w-3" />
                        )}
                        {tx.type}
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingCash(tx)}
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

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit trade — {username}</DialogTitle>
            <DialogDescription>
              {editing?.symbol} · {editing?.side} · {editing ? formatDate(editing.closeTime) : ""} —
              the owner is notified of admin changes.
            </DialogDescription>
          </DialogHeader>
          <TradeForm
            initial={editing}
            pending={updateMutation.isPending}
            submitLabel="Save changes"
            onSubmit={(input) => editing && updateMutation.mutate({ id: editing.id, input })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} selected trade{selected.size === 1 ? "" : "s"} from {username}&apos;s journal?</DialogTitle>
            <DialogDescription>
              This cannot be undone and the owner will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBulkConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate([...selected])}
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this trade from {username}&apos;s journal?</DialogTitle>
            <DialogDescription>
              {deleting?.symbol} {deleting?.side} {deleting?.lots} lots ·{" "}
              <span className={pnlClass(deleting?.netProfit)}>
                {fmtSignedMoney(deleting?.netProfit)}
              </span>{" "}
              — this cannot be undone and the owner will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingCash} onOpenChange={(open) => !open && setDeletingCash(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this transaction from {username}&apos;s journal?</DialogTitle>
            <DialogDescription>
              {deletingCash?.type} of {fmtMoney(deletingCash?.amount)} on{" "}
              {deletingCash ? formatDate(deletingCash.date) : ""} — this cannot be undone and the
              owner will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeletingCash(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCashMutation.isPending}
              onClick={() => deletingCash && deleteCashMutation.mutate(deletingCash.id)}
            >
              {deleteCashMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
