"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** TH ⇄ EN switch — shows the language you'd switch to. */
export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang(lang === "en" ? "th" : "en")}
      title={lang === "en" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
    >
      <Languages className="h-4 w-4" />
      {lang === "en" ? "ไทย" : "EN"}
    </Button>
  );
}
