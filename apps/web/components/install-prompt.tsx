"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { isIos, isStandalone } from "@/lib/use-push";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIosHint(isIos());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferredPrompt) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === "accepted") setDeferredPrompt(null);
        }}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{t("chrome.installApp")}</span>
      </Button>
    );
  }

  if (iosHint) {
    return (
      <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:inline-flex">
        <Share className="h-3.5 w-3.5" />
        {t("chrome.iosHint")}
      </span>
    );
  }

  return null;
}
