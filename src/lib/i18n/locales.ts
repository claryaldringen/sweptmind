// Relative import: dictionaries are type-checked standalone too
import { USER_LOCALES, isUserLocale, type UserLocale } from "../../domain/entities/user";

/** Supported UI languages. Server-safe (no "use client"), shared by client and server. */
export const LOCALES = USER_LOCALES;

export type Locale = UserLocale;

export const DEFAULT_LOCALE: Locale = "cs";

/** Each language's name in that language, for the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  cs: "Čeština",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  fr: "Français",
  es: "Español",
};

export const isLocale = isUserLocale;

/** A stored or reported locale (cookie, DB), falling back for anything unsupported. */
export function resolveLocale(
  value: string | null | undefined,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  return isLocale(value) ? value : fallback;
}

/** The first supported language among browser preferences ("de-AT" → "de"). */
export function matchLocale(languages: readonly string[]): Locale | null {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}
