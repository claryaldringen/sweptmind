import type { Locale } from "@/lib/i18n/types";

/**
 * Pořadí štítků v nabídce: naposledy použité nahoře.
 *
 * Štítky, které se ještě nepoužily (`lastUsedAt` je null), jdou pod ně
 * a mezi sebou se řadí podle názvu, aby bylo pořadí předvídatelné.
 * Abeceda se řídí jazykem aplikace, ne jazykem prohlížeče – v češtině
 * patří „č" za „c", v angličtině mezi „c".
 * Vstupní pole se nemění – vrací se nová kopie.
 */
export function sortTagsByLastUsed<T extends { name: string; lastUsedAt?: string | null }>(
  tags: readonly T[],
  locale: Locale,
): T[] {
  const byName = new Intl.Collator(locale).compare;
  return [...tags].sort((a, b) => {
    if (a.lastUsedAt && b.lastUsedAt) {
      if (a.lastUsedAt === b.lastUsedAt) return byName(a.name, b.name);
      return a.lastUsedAt < b.lastUsedAt ? 1 : -1;
    }
    if (a.lastUsedAt) return -1;
    if (b.lastUsedAt) return 1;
    return byName(a.name, b.name);
  });
}
