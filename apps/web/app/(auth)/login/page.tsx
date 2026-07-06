"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeFor, useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

function LoginForm() {
  const { t } = useI18n();
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(usernameOrEmail.trim(), password);
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : homeFor(user.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed.");
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.signIn")}</CardTitle>
        <CardDescription>{t("auth.signInDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="usernameOrEmail">{t("auth.usernameOrEmail")}</Label>
            <Input
              id="usernameOrEmail"
              autoComplete="username"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("auth.register")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
