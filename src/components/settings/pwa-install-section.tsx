"use client";

import { useSyncExternalStore } from "react";
import { AppWindow, Check, Download } from "lucide-react";
import { getPlatform } from "@sweptmind/native-bridge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { isStandalone, promptPwaInstall, usePwaInstallState } from "@/lib/pwa-install";

const noSubscribe = () => () => {};

/**
 * A browser tab outside Apple devices — Macs get the desktop app (DesktopAppSection)
 * and Safari on iOS can't install from a button.
 */
function canOfferPwa(): boolean {
  return (
    getPlatform() === "web" &&
    !isStandalone() &&
    !/Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent)
  );
}

/** Installing the web app (Windows, Linux, Android browsers) — a lasting home for the banner. */
export function PwaInstallSection() {
  const { t } = useTranslations();
  const show = useSyncExternalStore(noSubscribe, canOfferPwa, () => false);
  const installState = usePwaInstallState();
  if (!show) return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <AppWindow className="h-4 w-4" />
        {t("pwa.settingsTitle")}
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">{t("pwa.settingsDescription")}</p>
      {installState === "installed" ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-green-600" />
          {t("pwa.settingsInstalled")}
        </p>
      ) : installState === "available" ? (
        <Button size="sm" onClick={() => promptPwaInstall()}>
          <Download className="mr-2 h-4 w-4" />
          {t("pwa.installButton")}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">{t("pwa.settingsUnavailable")}</p>
      )}
    </section>
  );
}
