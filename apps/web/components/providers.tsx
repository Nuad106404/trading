"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );

  // Background Sync + periodic sync: when the SW replays queued offline
  // mutations (or asks for a periodic refresh), revalidate everything.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "BG_SYNC_REPLAYED") {
        void queryClient.invalidateQueries();
        toast.success("Offline changes synced.");
      } else if (event.data?.type === "PERIODIC_REFRESH") {
        void queryClient.invalidateQueries();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          {children}
          <Toaster theme="dark" richColors position="top-right" />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
