import { describe, it, expect } from "vitest";
import { parseAcceptLanguage } from "../server";

describe("parseAcceptLanguage", () => {
  it("vrátí jazyky v pořadí bez vah", () => {
    expect(parseAcceptLanguage("de-DE,de;q=0.9, en;q=0.8")).toEqual(["de-DE", "de", "en"]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
  });
});
