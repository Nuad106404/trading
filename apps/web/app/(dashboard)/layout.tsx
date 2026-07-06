"use client";

import {
  ArrowDownUp,
  CandlestickChart,
  LineChart,
  ListOrdered,
  LogOut,
  ShieldCheck,
  Upload,
  User as UserIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { InstallPrompt } from "@/components/install-prompt";
import { LanguageToggle } from "@/components/language-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { registerPeriodicSync } from "@/lib/use-push";
import { useTradingEvents } from "@/lib/use-trading-events";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  // live per-component updates whenever this user's journal changes anywhere
  useTradingEvents(!!user);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    void registerPeriodicSync();
  }, []);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("chrome.loading")}
      </div>
    );
  }

  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const navItems = [
    ...(isAdmin
      ? [
          { href: "/admin/users", label: t("nav.users"), icon: Users },
          { href: "/admin/trading-overview", label: t("nav.tradingOverview"), icon: LineChart },
        ]
      : []),
    { href: "/trading", label: t("nav.trading"), icon: CandlestickChart, exact: true },
    { href: "/trading/trades", label: t("nav.trades"), icon: ListOrdered },
    { href: "/trading/cash", label: t("nav.cash"), icon: ArrowDownUp },
    { href: "/trading/import", label: t("nav.import"), icon: Upload },
    { href: "/profile", label: t("nav.profile"), icon: UserIcon },
  ];

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 flex-col border-r bg-card sm:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </span>
          Trade Journal
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <p className="truncate font-medium text-foreground">{user.username}</p>
          <p className="capitalize">{user.role}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-card/95 px-3 py-3 backdrop-blur sm:px-4"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2 sm:hidden">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold">Trade Journal</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <InstallPrompt />
            <LanguageToggle />
            <Badge variant="outline" className="hidden capitalize md:inline-flex">
              {user.role}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-3 pb-24 sm:p-6 sm:pb-6">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
