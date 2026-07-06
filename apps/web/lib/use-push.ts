"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export type PushState =
  | "unsupported"
  | "ios-needs-install" // iOS Safari outside an installed PWA — Web Push unavailable
  | "denied"
  | "disabled"
  | "enabled";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("unsupported");
  const [busy, setBusy] = useState(false);

  const detect = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState(isIos() && !isStandalone() ? "ios-needs-install" : "unsupported");
      return;
    }
    if (isIos() && !isStandalone()) {
      setState("ios-needs-install");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? "enabled" : "disabled");
    } catch {
      setState("disabled");
    }
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return false;
      }

      let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      if (!vapidKey || vapidKey.startsWith("your_")) {
        const res = await api<{ publicKey: string }>("/push/vapid-public-key");
        vapidKey = res.publicKey;
      }
      if (!vapidKey) throw new Error("Push is not configured on the server (missing VAPID key).");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const json = subscription.toJSON();
      await api("/push/subscribe", {
        method: "POST",
        body: {
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: navigator.userAgent,
        },
      });
      setState("enabled");
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await api("/push/subscribe", { method: "DELETE", body: { endpoint } }).catch(
          () => undefined,
        );
      }
      setState("disabled");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    return api<{ delivered: number }>("/push/test", { method: "POST", body: {} });
  }, []);

  return { state, busy, enable, disable, sendTest, refresh: detect };
}

/** Progressive enhancement: periodic background refresh of dashboard data (Chromium only). */
export async function registerPeriodicSync(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration: any = await navigator.serviceWorker.ready;
    if (!registration.periodicSync) return;
    const status = await navigator.permissions
      .query({ name: "periodic-background-sync" as PermissionName })
      .catch(() => null);
    if (status && status.state !== "granted") return;
    await registration.periodicSync.register("refresh-dashboard", {
      minInterval: 12 * 60 * 60 * 1000,
    });
  } catch {
    // unsupported or rejected — fail silently by design
  }
}
