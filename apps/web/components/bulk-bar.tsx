"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Action bar shown while table rows are selected. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <span className="text-sm font-medium">
        {count} {t("bulk.selected")}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t("bulk.clear")}
        </Button>
        {children}
      </div>
    </div>
  );
}

/** Consistent checkbox for row selection. */
export function RowCheckbox({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 cursor-pointer rounded border-input accent-amber-500 disabled:cursor-not-allowed disabled:opacity-30"
      checked={checked}
      disabled={disabled}
      aria-label={label ?? "Select row"}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
