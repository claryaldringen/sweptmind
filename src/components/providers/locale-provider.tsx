"use client";

import { useMemo, useEffect } from "react";
import { useLocale } from "@/hooks/use-locale";
import { I18nContext, createTranslate } from "@/lib/i18n";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const { t, tArray } = useMemo(() => createTranslate(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext value={{ t, tArray, locale }}>{children}</I18nContext>;
}
