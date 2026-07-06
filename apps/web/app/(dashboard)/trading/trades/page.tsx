"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
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
import { fmtSignedMoney, pnlClass } from "@/lib/trading";
import type { Trade, TradeInput } from "@/lib/trading-types";
import type { Paginated } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const SORTABLE: { key: string; labelKey: string }[] = [
  { key: "symbol", labelKey: "trades.symbol" },
  { key: "side", labelKey: "trades.side" },
  { key: "lots", labelKey: "trades.lots" },
  { key: "profit", labelKey: "trades.netPnl" },
  { key: "closeTime", labelKey: "trades.closed" },
];

function offlineAwareError(err: unknown, fallback: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    toast.info("You're offline — saved locally and will sync when you're back online.");
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

export default function TradesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [result, setResult] = useState("");
  const [sortBy, setSortBy] = useState("closeTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState<Trade | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });
    if (search) params.set("search", search);
    if (symbol) params.set("symbol", symbol.toUpperCase());
    if (side) params.set("side", side);
    if (result) params.set("result", result);
    return params.toString();
  }, [page, limit, search, symbol, side, result, sortBy, sortOrder]);

  const tradesQuery = useQuery({
    queryKey: ["trading", "trades", queryString],
    queryFn: () => api<Paginated<Trade>>(`/trading/trades?${queryString}`),
  });

  // selection doesn't survive filter/page changes — avoids deleting unseen rows
  useEffect(() => setSelected(new Set()), [queryString]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["trading"] });

  const createMutation = useMutation({
    mutationFn: (input: TradeInput) => api<Trade>("/trading/trades", { method: "POST", body: input }),
    onSuccess: () => {
      toast.success("Trade added.");
      void invalidate();
    },
    onError: (err) => offlineAwareError(err, "Failed to add trade."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TradeInput }) =>
      api<Trade>(`/trading/trades/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      toast.success("Trade updated.");
      setEditing(null);
      void invalidate();
    },
    onError: (err) => offlineAwareError(err, "Failed to update trade."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/trading/trades/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Trade deleted.");
      setDeleting(null);
      void invalidate();
    },
    onError: (err) => offlineAwareError(err, "Failed to delete trade."),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number }>("/trading/trades/bulk-delete", { method: "POST", body: { ids } }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} trade${result.deleted === 1 ? "" : "s"} deleted.`);
      setSelected(new Set());
      setBulkConfirm(false);
      void invalidate();
    },
    onError: (err) => offlineAwareError(err, "Failed to delete trades."),
  });

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pageIds = tradesQuery.data?.data.map((trade) => trade.id) ?? [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(allPageSelected ? new Set() : new Set(pageIds));

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const data = tradesQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <h1 className="text-xl font-semibold sm:text-2xl">
        {t("trades.title1")} <span className="text-amber-400">{t("trades.title2")}</span>
      </h1>

      <Card>
        <CardHeader
          className="cursor-pointer select-none flex-row items-center justify-between space-y-0 py-4"
          onClick={() => setShowForm((s) => !s)}
        >
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("trades.addTrade")}
          </CardTitle>
          {showForm ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        {showForm && (
          <CardContent>
            <TradeForm
              pending={createMutation.isPending}
              submitLabel={t("trades.addTrade")}
              onSubmit={(input) => createMutation.mutate(input)}
            />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <div className="relative min-w-40 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("trades.searchPlaceholder")}
                className="pl-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Input
              placeholder={t("trades.symbol")}
              className="w-24 font-mono uppercase sm:w-28"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setPage(1);
              }}
            />
            <Select
              className="w-24 sm:w-28"
              value={side}
              onChange={(e) => {
                setSide(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("trades.allSides")}</option>
              <option value="buy">buy</option>
              <option value="sell">sell</option>
            </Select>
            <Select
              className="w-28 sm:w-32"
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("trades.winAndLoss")}</option>
              <option value="win">{t("trades.winsOnly")}</option>
              <option value="loss">{t("trades.lossesOnly")}</option>
            </Select>
            <Button type="submit" variant="secondary">
              {t("common.filter")}
            </Button>
          </form>

          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="destructive" size="sm" onClick={() => setBulkConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              {t("common.delete")}
            </Button>
          </BulkBar>

          {tradesQuery.isPending ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("trades.loading")}
            </div>
          ) : tradesQuery.isError ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {typeof navigator !== "undefined" && !navigator.onLine
                ? t("common.offline")
                : t("common.failedToLoad")}
            </div>
          ) : data && data.data.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("trades.noMatch")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <RowCheckbox checked={allPageSelected} onChange={toggleAll} label="Select all" />
                  </TableHead>
                  {SORTABLE.map(({ key, labelKey }) => (
                    <TableHead key={key}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort(key)}
                      >
                        {t(labelKey)}
                        {sortBy === key ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>{t("trades.prices")}</TableHead>
                  <TableHead>{t("trades.tagsNotes")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <RowCheckbox
                        checked={selected.has(trade.id)}
                        onChange={() => toggleRow(trade.id)}
                      />
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
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {trade.openPrice != null && trade.closePrice != null
                        ? `${trade.openPrice} → ${trade.closePrice}`
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-52">
                      <div className="flex flex-wrap items-center gap-1">
                        {(trade.tags ?? []).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                        {trade.notes && (
                          <span className="truncate text-xs text-muted-foreground">{trade.notes}</span>
                        )}
                      </div>
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
                {t("common.page")} {data.page} {t("common.of")} {totalPages} · {data.total}{" "}
                {t("trades.count")}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("common.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("trades.editTitle")}</DialogTitle>
            <DialogDescription>
              {editing?.symbol} · {editing?.side} · {editing ? formatDate(editing.closeTime) : ""}
            </DialogDescription>
          </DialogHeader>
          <TradeForm
            initial={editing}
            pending={updateMutation.isPending}
            submitLabel={t("common.save")}
            onSubmit={(input) => editing && updateMutation.mutate({ id: editing.id, input })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bulk.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {selected.size} {t("trades.count")} — {t("bulk.deleteDesc")}
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
            <DialogTitle>{t("trades.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {deleting?.symbol} {deleting?.side} {deleting?.lots} lots ·{" "}
              <span className={pnlClass(deleting?.netProfit)}>
                {fmtSignedMoney(deleting?.netProfit)}
              </span>{" "}
              — {t("common.cannotUndo")}
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
