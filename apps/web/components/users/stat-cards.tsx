"use client";

import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { UserStats } from "@/lib/types";

const CARDS = [
  { key: "total", label: "Total users", icon: Users, color: "text-primary" },
  { key: "active", label: "Active", icon: UserCheck, color: "text-success" },
  { key: "suspended", label: "Suspended", icon: UserX, color: "text-destructive" },
  { key: "admins", label: "Admins", icon: ShieldCheck, color: "text-yellow-500" },
] as const;

export function StatCards({ stats }: { stats?: UserStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, color }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary ${color}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-semibold leading-tight">{stats ? stats[key] : "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
