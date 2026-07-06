import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import { BackgroundSyncQueue, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function notifyClients(message: Record<string, unknown>): Promise<void> {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) client.postMessage(message);
}

/**
 * Background Sync — offline write actions against the API are queued here and
 * replayed when connectivity returns. The original request (including its
 * Authorization header) is stored as-is; tokens are never persisted separately.
 */
const mutationQueue = new BackgroundSyncQueue("user-mutations-queue", {
  maxRetentionTime: 24 * 60, // minutes
  onSync: async ({ queue }) => {
    let entry;
    let replayed = 0;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        // Access token expired by replay time → drop gracefully; the client
        // shows true state on the next authenticated load.
        if (response.status === 401 || response.status === 403) continue;
        replayed++;
      } catch (error) {
        await queue.unshiftRequest(entry);
        throw error; // still offline — retry on the next sync event
      }
    }
    if (replayed > 0) await notifyClients({ type: "BG_SYNC_REPLAYED", replayed });
  },
});

const isApiUrl = (url: URL) => url.href.startsWith(API_URL);

const isQueueableMutation = (url: URL, request: Request) =>
  isApiUrl(url) &&
  ["POST", "PATCH", "PUT", "DELETE"].includes(request.method) &&
  (url.pathname.startsWith("/users") ||
    url.pathname.startsWith("/profile") ||
    url.pathname.startsWith("/trading")); // offline trade/cash entries replay on reconnect

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Mutations to the API: network-only, but queued for Background Sync when offline.
    {
      matcher: ({ url, request }) => isQueueableMutation(url, request),
      handler: new NetworkOnly({
        plugins: [
          {
            fetchDidFail: async ({ request }) => {
              await mutationQueue.pushRequest({ request });
            },
          },
        ],
      }),
    },
    // Everything else on the API (auth, user data, push): NEVER cached.
    // Sensitive responses and tokens must not be served from the SW cache.
    {
      matcher: ({ url }) => isApiUrl(url),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// ---------------------------------------------------------------- Web Push

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string; icon?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Trade Journal", body: event.data?.text() ?? "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Trade Journal", {
      body: data.body ?? "",
      icon: data.icon ?? "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl: string = event.notification.data?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await (client as WindowClient).navigate(targetUrl).catch(() => undefined);
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

// ------------------------------------------- Periodic Background Sync (Chromium)

self.addEventListener("periodicsync", (event: any) => {
  if (event.tag === "refresh-dashboard") {
    event.waitUntil(notifyClients({ type: "PERIODIC_REFRESH" }));
  }
});

serwist.addEventListeners();
