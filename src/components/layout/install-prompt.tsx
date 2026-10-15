"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { isStandalone, promptPwaInstall, usePwaInstallState } from "@/lib/pwa-install";

const DISMISSED_KEY = "sweptmind-install-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { t } = useTranslations();
  const installState = usePwaInstallState();
  // Read lazily: the state is "unavailable" on the server and during hydration anyway
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && wasDismissed());

  if (installState !== "available" || dismissed || isStandalone()) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable — the banner just comes back next time
    }
  }

  return (
    <div className="bg-primary/10 border-primary/20 flex items-center gap-3 border-b px-4 py-2">
      <Download className="text-primary h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("pwa.installTitle")}</p>
        <p className="text-muted-foreground text-xs">{t("pwa.installDescription")}</p>
      </div>
      <Button size="sm" onClick={() => promptPwaInstall()}>
        {t("pwa.installButton")}
      </Button>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
