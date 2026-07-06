"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { downloadCsvTemplate, parseMt5Csv, type ParsedCsv } from "@/lib/mt5-csv";
import { parseMt5Journal } from "@/lib/mt5-journal";
import { parseMt5ReportXlsx } from "@/lib/mt5-report";
import { fmtSignedMoney, pnlClass } from "@/lib/trading";
import { invalidateTradingScopes } from "@/lib/use-trading-events";
import { cn } from "@/lib/utils";

export default function ImportPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);

  const applyResult = useCallback((result: ParsedCsv, name: string) => {
    setParsed(result);
    setFileName(name);
    if (result.trades.length === 0 && result.transactions.length === 0) {
      toast.error("No importable rows found in this file.");
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx")) {
        // MT5 → Reports → "Open XML (Excel)" export
        file
          .arrayBuffer()
          .then(parseMt5ReportXlsx)
          .then((result) => applyResult(result, file.name))
          .catch(() => toast.error("Could not parse this .xlsx file."));
        return;
      }
      if (!name.endsWith(".csv") && !name.endsWith(".txt") && !name.endsWith(".log")) {
        toast.error("Please choose a .xlsx (MT5 report), .txt (mobile journal) or .csv file.");
        return;
      }
      const isJournal = name.endsWith(".txt") || name.endsWith(".log");
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? "");
        applyResult(isJournal ? parseMt5Journal(content) : parseMt5Csv(content), file.name);
      };
      reader.onerror = () => toast.error("Could not read the file.");
      reader.readAsText(file);
    },
    [applyResult],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const importMutation = useMutation({
    mutationFn: (payload: ParsedCsv) =>
      api<{
        importedTrades: number;
        importedTransactions: number;
        skippedTrades: number;
        skippedTransactions: number;
      }>("/trading/trades/bulk-import", {
        method: "POST",
        body: { trades: payload.trades, transactions: payload.transactions },
      }),
    onSuccess: (result) => {
      const skipped = result.skippedTrades + result.skippedTransactions;
      toast.success(
        `Imported ${result.importedTrades} trades and ${result.importedTransactions} cash transactions.` +
          (skipped > 0 ? ` ${skipped} duplicate entr${skipped === 1 ? "y" : "ies"} skipped.` : ""),
      );
      invalidateTradingScopes(queryClient, ["trades", "cash", "stats"]);
      router.push("/trading");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Import failed — nothing was saved."),
  });

  const totalNet =
    parsed?.trades.reduce(
      (sum, t) => sum + (t.profit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0),
      0,
    ) ?? 0;

  const reset = () => {
    setParsed(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {t("import.title1")} <span className="text-amber-400">{t("import.title2")}</span>
        </h1>
        <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
          <Download className="h-4 w-4" />
          {t("import.csvTemplate")}
        </Button>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragOver ? "border-amber-400 bg-amber-400/5" : "border-border hover:border-amber-400/50",
        )}
      >
        <FileSpreadsheet className="h-10 w-10 text-amber-400" />
        <div>
          <p className="font-medium">{t("import.dropHere")}</p>
          <p className="text-sm text-muted-foreground">{t("import.browse")}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.txt,.log,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {parsed && (
        <Card className="border-amber-500/20">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("import.preview")} — {fileName}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={reset} title="Clear">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
              <div className="rounded-md bg-secondary/60 p-3">
                <p className="font-mono text-lg font-semibold sm:text-xl">{parsed.trades.length}</p>
                <p className="text-xs text-muted-foreground">{t("import.trades")}</p>
              </div>
              <div className="rounded-md bg-secondary/60 p-3">
                <p className="font-mono text-lg font-semibold sm:text-xl">{parsed.transactions.length}</p>
                <p className="text-xs text-muted-foreground">{t("import.cashTx")}</p>
              </div>
              <div className="rounded-md bg-secondary/60 p-3">
                <p className={cn("truncate font-mono text-lg font-semibold sm:text-xl", pnlClass(totalNet))}>
                  {fmtSignedMoney(totalNet)}
                </p>
                <p className="text-xs text-muted-foreground">{t("import.netToImport")}</p>
              </div>
            </div>

            {parsed.errors.length > 0 && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-500">
                <p className="mb-1 font-medium">{parsed.errors.length} {t("import.skipped")}</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {parsed.errors.slice(0, 8).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {parsed.errors.length > 8 && <li>… and {parsed.errors.length - 8} more</li>}
                </ul>
              </div>
            )}

            {parsed.trades.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Lots</TableHead>
                    <TableHead>Net P&L</TableHead>
                    <TableHead>Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.trades.slice(0, 5).map((t, i) => {
                    const net = (t.profit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-amber-400">{t.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={t.side === "buy" ? "success" : "destructive"}>
                            {t.side}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{t.lots.toFixed(2)}</TableCell>
                        <TableCell className={cn("font-mono", pnlClass(net))}>
                          {fmtSignedMoney(net)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.closeTime ? new Date(t.closeTime).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {parsed.trades.length > 5 && (
              <p className="text-center text-xs text-muted-foreground">
                … and {parsed.trades.length - 5} more trades
              </p>
            )}

            <Button
              className="self-end"
              disabled={
                importMutation.isPending ||
                (parsed.trades.length === 0 && parsed.transactions.length === 0)
              }
              onClick={() => importMutation.mutate(parsed)}
            >
              {importMutation.isPending ? (
                t("import.importing")
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t("import.confirm")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Upload className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>
              <span className="font-medium text-foreground">{t("import.help.xlsxLabel")}</span>{" "}
              {t("import.help.xlsxBody")}
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">{t("import.help.txtLabel")}</span>{" "}
              {t("import.help.txtBody")}
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">{t("import.help.csvLabel")}</span>{" "}
              {t("import.help.csvBody")}
            </p>
            <p className="mt-1">{t("import.help.dedup")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
