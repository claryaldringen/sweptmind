"use client";

import { useTranslations } from "@/lib/i18n";

export default function AppError({ reset }: { reset: () => void }) {
  const { t } = useTranslations();

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t("common.errorTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("common.errorDescription")}</p>
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 text-sm font-medium"
        >
          {t("common.errorRetry")}
        </button>
      </div>
    </div>
  );
}
