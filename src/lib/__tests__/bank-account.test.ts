import { describe, it, expect } from "vitest";
import { czechAccountFromIban, formatIban, parseIban } from "../bank-account";

describe("formatIban", () => {
  it("rozdělí IBAN po čtyřech znacích", () => {
    expect(formatIban("CZ6508000000192000145399")).toBe("CZ65 0800 0000 1920 0014 5399");
    expect(formatIban("CZ65 0800 0000 1920 0014 5399")).toBe("CZ65 0800 0000 1920 0014 5399");
  });
});

describe("czechAccountFromIban", () => {
  it("převede český IBAN na číslo účtu s předčíslím i bez něj", () => {
    expect(czechAccountFromIban("CZ6508000000192000145399")).toBe("19-2000145399/0800");
    expect(czechAccountFromIban("CZ7020100000002801234567")).toBe("2801234567/2010");
  });

  it("jiné země a nesmysly vrátí null", () => {
    expect(czechAccountFromIban("DE89370400440532013000")).toBeNull();
    expect(czechAccountFromIban("nonsense")).toBeNull();
  });
});

describe("parseIban", () => {
  it("vytáhne IBAN z hodnoty s mezerami nebo zbytky escapování", () => {
    expect(parseIban("CZ6508000000192000145399\\n")).toBe("CZ6508000000192000145399");
    expect(parseIban(" cz65 0800 0000 1920 0014 5399 ")).toBe("CZ6508000000192000145399");
    expect(parseIban(undefined)).toBeNull();
    expect(parseIban("")).toBeNull();
  });
});
