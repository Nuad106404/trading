"use client";

import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_URL } from "./api";
import { getTokens } from "./tokens";

export type TradingScope = "trades" | "cash" | "stats";

/** which query-key suffixes (under ["trading", …]) each scope touches */
const SCOPE_KEYS: Record<TradingScope, string[]> = {
  trades: ["trades"],
  cash: ["cash"],
  stats: ["summary", "equity-curve", "monthly", "by-symbol", "max-drawdown"],
};

/**
 * Invalidate only the components affected by the given scopes. TanStack Query
 * refetches just the ACTIVE queries under each key, in the background — data
 * stays on screen until fresh data arrives, so nothing visibly "reloads".
 */
export function invalidateTradingScopes(queryClient: QueryClient, scopes: TradingScope[]): void {
  const keys = new Set<string>();
  for (const scope of scopes) {
    for (const key of SCOPE_KEYS[scope] ?? []) keys.add(key);
  }
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: ["trading", key] });
  }
}

/**
 * Live journal updates over SSE. Any mutation — from another device, another
 * tab, an import, or an admin editing your journal — triggers a scope event,
 * and only the affected components refresh. Reconnects with the current
 * access token whenever the stream drops (e.g. after token expiry).
 */
export function useTradingEvents(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("EventSource" in window)) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      const token = getTokens()?.accessToken;
      if (!token) {
        retryTimer = setTimeout(connect, 10_000);
        return;
      }
      source = new EventSource(`${API_URL}/trading/events?token=${encodeURIComponent(token)}`);

      source.onmessage = (event) => {
        if (!event.data || event.data === "ping") return;
        try {
          const payload = JSON.parse(event.data) as { scopes?: TradingScope[] };
          if (payload.scopes?.length) invalidateTradingScopes(queryClient, payload.scopes);
        } catch {
          // ignore malformed frames
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (!stopped) retryTimer = setTimeout(connect, 5_000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled, queryClient]);
}
