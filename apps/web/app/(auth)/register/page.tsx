"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dots, dashes and underscores"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password needs at least one letter and one number"),
    confirm: z.string(),
    fullName: z.string().max(100).optional(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FieldErrors = Partial<Record<"username" | "email" | "password" | "confirm" | "fullName", string>>;

export default function RegisterPage() {
  const { t } = useI18n();
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
    fullName: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await register({
        username: parsed.data.username.toLowerCase(),
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName || undefined,
      });
      toast.success("Account created — welcome!");
      router.push("/profile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed.");
      setSubmitting(false);
    }
  };

  const field = (
    id: keyof typeof form,
    label: string,
    type = "text",
    autoComplete?: string,
    required = true,
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={form[id]}
        onChange={set(id)}
      />
      {errors[id] && <p className="text-xs text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.createAccount")}</CardTitle>
        <CardDescription>{t("auth.registerDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {field("username", t("auth.username"), "text", "username")}
          {field("email", t("profile.email"), "email", "email")}
          {field("fullName", t("auth.fullNameOptional"), "text", "name", false)}
          {field("password", t("auth.password"), "password", "new-password")}
          {field("confirm", t("auth.confirmPassword"), "password", "new-password")}
          <Button type="submit" disabled={submitting}>
            {submitting ? t("auth.creating") : t("auth.createAccount")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
