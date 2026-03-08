import { describe, it, expect } from "vitest";
import { formatLocationName } from "../shorten-display-name";

describe("formatLocationName", () => {
  it("formats name + country for cities", () => {
    expect(formatLocationName({ name: "Praha", country: "Česko" })).toBe("Praha, Česko");
  });

  it("formats name + city + country for neighborhoods", () => {
    expect(
      formatLocationName({ name: "Lužiny", city: "Praha", country: "Česko" }),
    ).toBe("Lužiny, Praha, Česko");
  });

  it("skips city when same as name", () => {
    expect(
      formatLocationName({ name: "Beroun", city: "Beroun", country: "Česko" }),
    ).toBe("Beroun, Česko");
  });

  it("formats name + country for foreign cities", () => {
    expect(formatLocationName({ name: "Berlín", country: "Německo" })).toBe("Berlín, Německo");
  });

  it("formats foreign places with city", () => {
    expect(
      formatLocationName({ name: "Kreuzberg", city: "Berlín", country: "Německo" }),
    ).toBe("Kreuzberg, Berlín, Německo");
  });

  it("returns just name when country is missing", () => {
    expect(formatLocationName({ name: "Somewhere" })).toBe("Somewhere");
  });

  it("returns empty string for empty input", () => {
    expect(formatLocationName({})).toBe("");
  });
});
