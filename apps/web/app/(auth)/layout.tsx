import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/language-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="absolute right-4 top-4" style={{ top: "max(1rem, env(safe-area-inset-top))" }}>
        <LanguageToggle />
      </div>
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </span>
        Trade Journal
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
