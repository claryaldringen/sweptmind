"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { getPlatform } from "@sweptmind/native-bridge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import type { AppRelease } from "@/lib/app-releases";

const noSubscribe = () => () => {};

/** Browsing the web on Android — not in the Android app itself. */
function isAndroidBrowser(): boolean {
  return getPlatform() === "web" && /Android/i.test(navigator.userAgent);
}

/** Offers the Android app (APK from the newest android-v* GitHub release). */
export function AndroidAppSection() {
  const { t } = useTranslations();
  const show = useSyncExternalStore(noSubscribe, isAndroidBrowser, () => false);
  const [release, setRelease] = useState<AppRelease | null>(null);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetch("/api/app-downloads")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { android?: AppRelease | null } | null) => {
        if (!cancelled) setRelease(data?.android ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [show]);

  if (!show || !release) return null;

  return (
    <section className="rounded-lg border p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Smartphone className="h-4 w-4" />
        {t("androidApp.title")}
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">{t("androidApp.description")}</p>
      <Button asChild size="sm">
        <a href={release.url}>
          <Download className="mr-2 h-4 w-4" />
          {t("androidApp.download", { version: release.version })}
        </a>
      </Button>
      <p className="text-muted-foreground mt-3 text-xs">{t("androidApp.installNote")}</p>
    </section>
  );
}
