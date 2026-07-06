"use client";

import { Bell, BellOff, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { usePushNotifications } from "@/lib/use-push";

export function PushSettings() {
  const { t } = useI18n();
  const { state, busy, enable, disable, sendTest } = usePushNotifications();
  const [testing, setTesting] = useState(false);

  const handleToggle = async () => {
    try {
      if (state === "enabled") {
        await disable();
        toast.success("Push notifications disabled.");
      } else {
        const ok = await enable();
        if (ok) toast.success("Push notifications enabled.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update push settings.");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { delivered } = await sendTest();
      toast.success(
        delivered > 0
          ? `Test notification sent to ${delivered} device${delivered > 1 ? "s" : ""}.`
          : "No subscribed devices found.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test notification.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.push")}</CardTitle>
        <CardDescription>{t("profile.pushDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {state === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported in this browser.
          </p>
        )}
        {state === "ios-needs-install" && (
          <p className="text-sm text-muted-foreground">
            On iOS, install the app first (Share → Add to Home Screen), then enable notifications
            from inside the installed app (requires iOS 16.4+).
          </p>
        )}
        {state === "denied" && (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked. Allow them in your browser&apos;s site settings, then reload.
          </p>
        )}
        {(state === "enabled" || state === "disabled") && (
          <>
            <Button onClick={handleToggle} disabled={busy} variant={state === "enabled" ? "secondary" : "default"}>
              {state === "enabled" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {state === "enabled" ? t("profile.disablePush") : t("profile.enablePush")}
            </Button>
            {state === "enabled" && (
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                <Send className="h-4 w-4" />
                {t("profile.sendTest")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
