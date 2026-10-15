import { describe, it, expect } from "vitest";
import { matchLocale, resolveLocale } from "../locales";

describe("resolveLocale", () => {
  it("podporovaný jazyk vrátí, jinak výchozí", () => {
    expect(resolveLocale("de")).toBe("de");
    expect(resolveLocale("pl")).toBe("cs");
    expect(resolveLocale(undefined)).toBe("cs");
    expect(resolveLocale(null, "en")).toBe("en");
  });
});

describe("matchLocale", () => {
  it("vezme první podporovaný jazyk prohlížeče bez regionu", () => {
    expect(matchLocale(["pl-PL", "de-AT", "en"])).toBe("de");
    expect(matchLocale(["FR-ca"])).toBe("fr");
    expect(matchLocale(["pl", "ru"])).toBeNull();
    expect(matchLocale([])).toBeNull();
  });
});
