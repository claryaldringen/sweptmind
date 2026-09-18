import { describe, it, expect } from "vitest";
import { sortTagsByLastUsed } from "../sort-tags";

function tag(name: string, lastUsedAt: string | null = null) {
  return { id: name, name, lastUsedAt };
}

const names = (tags: { name: string }[]) => tags.map((t) => t.name);

describe("sortTagsByLastUsed", () => {
  it("řadí použité štítky od nejnovějšího", () => {
    const result = sortTagsByLastUsed(
      [
        tag("starý", "2026-09-01T10:00:00.000Z"),
        tag("nový", "2026-09-18T08:00:00.000Z"),
        tag("prostřední", "2026-09-10T12:00:00.000Z"),
      ],
      "cs",
    );
    expect(names(result)).toEqual(["nový", "prostřední", "starý"]);
  });

  it("rozlišuje čas ve stejném dni", () => {
    const result = sortTagsByLastUsed(
      [
        tag("ráno", "2026-09-18T08:00:00.000Z"),
        tag("večer", "2026-09-18T20:00:00.000Z"),
        tag("poledne", "2026-09-18T12:00:00.000Z"),
      ],
      "cs",
    );
    expect(names(result)).toEqual(["večer", "poledne", "ráno"]);
  });

  it("nepoužité štítky staví pod použité", () => {
    const result = sortTagsByLastUsed(
      [tag("nikdy-b"), tag("použitý", "2026-01-01T00:00:00.000Z"), tag("nikdy-a")],
      "cs",
    );
    expect(names(result)).toEqual(["použitý", "nikdy-a", "nikdy-b"]);
  });

  it("nepoužité štítky řadí abecedně", () => {
    const result = sortTagsByLastUsed([tag("cesta"), tag("auto"), tag("banka")], "cs");
    expect(names(result)).toEqual(["auto", "banka", "cesta"]);
  });

  it("řadí česky podle abecedy s diakritikou", () => {
    const result = sortTagsByLastUsed([tag("čaj"), tag("cukr"), tag("dům")], "cs");
    expect(names(result)).toEqual(["cukr", "čaj", "dům"]);
  });

  it("v angličtině řadí diakritiku podle základního písmene", () => {
    const result = sortTagsByLastUsed([tag("čaj"), tag("cukr"), tag("dům")], "en");
    expect(names(result)).toEqual(["čaj", "cukr", "dům"]);
  });

  it("při shodném čase použije název", () => {
    const stamp = "2026-09-18T08:00:00.000Z";
    const result = sortTagsByLastUsed([tag("beta", stamp), tag("alfa", stamp)], "cs");
    expect(names(result)).toEqual(["alfa", "beta"]);
  });

  it("nemění vstupní pole", () => {
    const input = [tag("b", "2026-01-01T00:00:00.000Z"), tag("a", "2026-09-01T00:00:00.000Z")];
    const snapshot = names(input);
    sortTagsByLastUsed(input, "cs");
    expect(names(input)).toEqual(snapshot);
  });

  it("zvládne prázdné pole", () => {
    expect(sortTagsByLastUsed([], "cs")).toEqual([]);
  });

  it("bere chybějící lastUsedAt jako nepoužitý", () => {
    const result = sortTagsByLastUsed(
      [
        { id: "1", name: "bez-pole" },
        { id: "2", name: "s-polem", lastUsedAt: "2026-09-01T00:00:00.000Z" },
      ],
      "cs",
    );
    expect(names(result)).toEqual(["s-polem", "bez-pole"]);
  });
});
