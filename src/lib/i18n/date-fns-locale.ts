import type { Locale as DateFnsLocale } from "date-fns";
import { cs } from "date-fns/locale/cs";
import { de } from "date-fns/locale/de";
import { enUS } from "date-fns/locale/en-US";
import { es } from "date-fns/locale/es";
import { fr } from "date-fns/locale/fr";
import { it } from "date-fns/locale/it";
import type { Locale } from "./locales";

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { cs, en: enUS, de, it, fr, es };

/** date-fns locale (month and day names) for an app language. */
export function getDateFnsLocale(locale: Locale): DateFnsLocale {
  return DATE_FNS_LOCALES[locale];
}
