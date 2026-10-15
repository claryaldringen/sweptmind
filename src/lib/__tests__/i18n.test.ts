import { describe, expect, it } from "vitest";
import { createTranslate, dictionaries } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

function collectStrings(value: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof value === "string") {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectStrings(child, path ? `${path}.${key}` : key, out);
    }
  }
}

const locales = Object.keys(dictionaries) as Locale[];

describe("interpolate", () => {
  it("substitutes single-brace placeholders", () => {
    const { t } = createTranslate("cs");
    expect(t("settings.aiLimit", { count: "500" })).toBe("500 analýz/měsíc");
  });

  it("leaves an unknown placeholder untouched", () => {
    const { t } = createTranslate("cs");
    expect(t("settings.aiLimit", { wrong: "500" })).toBe("{count} analýz/měsíc");
  });
});

describe.each(locales)("dictionary %s", (locale) => {
  // interpolate() only matches /\{(\w+)\}/ — a double-braced "{{count}}" would
  // substitute the inner braces and ship a literal "{500}" to users.
  it("uses single-brace placeholders", () => {
    const strings: Array<[string, string]> = [];
    collectStrings(dictionaries[locale], "", strings);
    const offenders = strings.filter(([, value]) => value.includes("{{"));
    expect(offenders).toEqual([]);
  });
});

describe.each(locales.filter((l) => l !== "en"))("dictionary %s matches English", (locale) => {
  const english: Array<[string, string]> = [];
  collectStrings(dictionaries.en, "", english);
  const translated = new Map<string, string>();
  const strings: Array<[string, string]> = [];
  collectStrings(dictionaries[locale], "", strings);
  strings.forEach(([path, value]) => translated.set(path, value));

  const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();

  // Paths include array indexes, so this also catches arrays of a different length —
  // except plural forms of recurrence units (Czech has three: 1, 2–4, 5+)
  it("has exactly the strings English has", () => {
    const englishPaths = new Set(english.map(([path]) => path));
    const isPluralForm = (path: string) => /^recurrence\.unit\w+\[\d+\]$/.test(path);
    const missing = [...englishPaths].filter((path) => !translated.has(path));
    const extra = [...translated.keys()].filter(
      (path) => !englishPaths.has(path) && !isPluralForm(path),
    );
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("keeps the placeholders of each string", () => {
    const mismatched = english
      .filter(([path, value]) => {
        const other = translated.get(path);
        return other !== undefined && placeholders(other).join() !== placeholders(value).join();
      })
      .map(([path]) => path);
    expect(mismatched).toEqual([]);
  });
});
