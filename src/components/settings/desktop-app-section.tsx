"use client";

import { useSyncExternalStore } from "react";
import { Download, Laptop } from "lucide-react";
import { getPlatform } from "@sweptmind/native-bridge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

// The desktop workflow marks each desktop release as the latest one
const MAC_DOWNLOAD_URL =
  "https://github.com/claryaldringen/sweptmind/releases/latest/download/SweptMind.dmg";

const noSubscribe = () => () => {};

/** Browsing the web on a Mac — not in the desktop app itself; iPads say "Macintosh" too. */
function isMacBrowser(): boolean {
  return (
    getPlatform() === "web" &&
    /Macintosh/.test(navigator.userAgent) &&
    navigator.maxTouchPoints <= 1
  );
}

/** Offers the macOS app (apps/desktop) to people using SweptMind in a Mac browser. */
export function DesktopAppSection() {
  const { t } = useTranslations();
  const show = useSyncExternalStore(noSubscribe, isMacBrowser, () => false);
  if (!show) return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Laptop className="h-4 w-4" />
        {t("desktopApp.title")}
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">{t("desktopApp.description")}</p>
      <Button asChild size="sm">
        <a href={MAC_DOWNLOAD_URL}>
          <Download className="mr-2 h-4 w-4" />
          {t("desktopApp.download")}
        </a>
      </Button>
      <p className="text-muted-foreground mt-3 text-xs">{t("desktopApp.firstLaunch")}</p>
    </section>
  );
}
