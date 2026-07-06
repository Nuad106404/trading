"use client";

import {
  ArrowDownUp,
  CandlestickChart,
  LineChart,
  ListOrdered,
  Upload,
  User as UserIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * App-style bottom tab bar for phones/small tablets (hidden on ≥sm where the
 * sidebar takes over). Admins get management tabs; users get journal tabs.
 */
export function MobileNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();

  if (!user) return null;
  const isAdmin = user.role === "admin" || user.role === "superadmin";

  const items = isAdmin
    ? [
        { href: "/admin/users", label: t("nav.users"), icon: Users },
        { href: "/admin/trading-overview", label: t("nav.overview"), icon: LineChart },
        { href: "/trading", label: t("nav.trading"), icon: CandlestickChart, exact: true },
        { href: "/trading/trades", label: t("nav.trades"), icon: ListOrdered },
        { href: "/profile", label: t("nav.profile"), icon: UserIcon },
      ]
    : [
        { href: "/trading", label: t("nav.dashboard"), icon: CandlestickChart, exact: true },
        { href: "/trading/trades", label: t("nav.trades"), icon: ListOrdered },
        { href: "/trading/cash", label: t("nav.cash"), icon: ArrowDownUp },
        { href: "/trading/import", label: t("nav.import"), icon: Upload },
        { href: "/profile", label: t("nav.profile"), icon: UserIcon },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-16 grid-cols-5">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-amber-400" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]")} />
              <span className="truncate px-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
