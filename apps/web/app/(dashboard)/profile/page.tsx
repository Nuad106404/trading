"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PushSettings } from "@/components/push-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/auth/change-password", {
        method: "PATCH",
        body: { currentPassword, newPassword },
      });
      toast.success("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 sm:gap-6">
      <h1 className="text-xl font-semibold sm:text-2xl">{t("profile.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {user.username}
            {user.isProtected && <Badge variant="warning">Protected</Badge>}
          </CardTitle>
          <CardDescription>{t("profile.accountDetails")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t("profile.email")}</p>
            <p className="break-all">{user.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("profile.fullName")}</p>
            <p>{user.fullName || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("profile.role")}</p>
            <p className="capitalize">{user.role}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("profile.status")}</p>
            <Badge variant={user.status === "active" ? "success" : "destructive"}>
              {user.status}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">{t("profile.lastLogin")}</p>
            <p>{formatDate(user.lastLoginAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("profile.memberSince")}</p>
            <p>{formatDate(user.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <PushSettings />

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="current">{t("profile.currentPassword")}</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new">{t("profile.newPassword")}</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">{t("profile.confirmNewPassword")}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="self-start">
              {submitting ? t("common.saving") : t("profile.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
