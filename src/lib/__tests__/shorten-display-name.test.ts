import { describe, it, expect } from "vitest";
import { formatLocationName } from "../shorten-display-name";

describe("formatLocationName", () => {
  it("formats name + state + country", () => {
    expect(
      formatLocationName({ name: "Beroun", state: "Středočeský kraj", country: "Česko" }),
    ).toBe("Beroun, Středočeský kraj, Česko");
  });

  it("formats name + country when state is missing", () => {
    expect(formatLocationName({ name: "Praha", country: "Česko" })).toBe("Praha, Česko");
  });

  it("formats name + country for foreign cities", () => {
    expect(formatLocationName({ name: "Berlín", country: "Německo" })).toBe("Berlín, Německo");
  });

  it("formats name + state + country for foreign places with state", () => {
    expect(formatLocationName({ name: "Bergen", state: "Vestland", country: "Norsko" })).toBe(
      "Bergen, Vestland, Norsko",
    );
  });

  it("returns just name when country is missing", () => {
    expect(formatLocationName({ name: "Somewhere" })).toBe("Somewhere");
  });

  it("returns empty string for empty input", () => {
    expect(formatLocationName({})).toBe("");
  });
});
