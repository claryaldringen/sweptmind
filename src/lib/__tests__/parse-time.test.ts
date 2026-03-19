import { describe, it, expect } from "vitest";
import { parseTimeInput } from "../parse-time";

describe("parseTimeInput", () => {
  it("parses HH:MM format", () => {
    expect(parseTimeInput("14:30")).toBe("14:30");
    expect(parseTimeInput("09:05")).toBe("09:05");
    expect(parseTimeInput("0:00")).toBe("00:00");
  });

  it("parses H:MM format", () => {
    expect(parseTimeInput("9:30")).toBe("09:30");
    expect(parseTimeInput("2:05")).toBe("02:05");
  });

  it("parses 1-2 digit hours only", () => {
    expect(parseTimeInput("14")).toBe("14:00");
    expect(parseTimeInput("9")).toBe("09:00");
    expect(parseTimeInput("0")).toBe("00:00");
    expect(parseTimeInput("23")).toBe("23:00");
  });

  it("parses 3-4 digit HHMM format", () => {
    expect(parseTimeInput("1430")).toBe("14:30");
    expect(parseTimeInput("0930")).toBe("09:30");
    expect(parseTimeInput("930")).toBe("09:30");
    expect(parseTimeInput("0000")).toBe("00:00");
  });

  it("parses am/pm format", () => {
    expect(parseTimeInput("2pm")).toBe("14:00");
    expect(parseTimeInput("2:30pm")).toBe("14:30");
    expect(parseTimeInput("12pm")).toBe("12:00");
    expect(parseTimeInput("12am")).toBe("00:00");
    expect(parseTimeInput("9am")).toBe("09:00");
    expect(parseTimeInput("9:15am")).toBe("09:15");
  });

  it("trims whitespace", () => {
    expect(parseTimeInput("  14:30  ")).toBe("14:30");
    expect(parseTimeInput(" 2 pm")).toBe("14:00");
  });

  it("is case insensitive for am/pm", () => {
    expect(parseTimeInput("2PM")).toBe("14:00");
    expect(parseTimeInput("9AM")).toBe("09:00");
  });

  it("returns null for invalid input", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("25")).toBeNull();
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("12:60")).toBeNull();
    expect(parseTimeInput("99:99")).toBeNull();
  });
});
