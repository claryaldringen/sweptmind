import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, matchLocale, resolveLocale, type Locale } from "./locales";

const COOKIE_KEY = "sweptmind-locale";

/** Accept-Language values in the order the browser sent them, without weights. */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);
}

/**
 * The language picked in the app (cookie), else the browser's preference — English for
 * languages we don't have (like the client does), Czech for requests without any.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(COOKIE_KEY)?.value;
  const languages = parseAcceptLanguage((await headers()).get("accept-language"));
  const fromBrowser = matchLocale(languages) ?? (languages.length > 0 ? "en" : DEFAULT_LOCALE);
  return resolveLocale(cookie, fromBrowser);
}
