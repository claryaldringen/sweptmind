import { describe, it, expect } from "vitest";
import { cs, enUS } from "date-fns/locale";
import { formatDueDate, formatTaskDate } from "../format-task-date";

const CS = { locale: "cs" as const, dateFnsLocale: cs };
const EN = { locale: "en" as const, dateFnsLocale: enUS };

describe("formatDueDate", () => {
  describe("bez koncového data", () => {
    it("vypíše datum s časem", () => {
      expect(formatDueDate("2026-08-27T11:00", null, { ...CS, withYear: true })).toBe(
        "27.8.2026, 11:00",
      );
    });

    it("vypíše datum bez času", () => {
      expect(formatDueDate("2026-08-27", null, { ...CS, withYear: true })).toBe("27.8.2026");
    });

    it("vynechá rok, když se nevyžaduje", () => {
      expect(formatDueDate("2026-08-27T11:00", null, CS)).toBe("27.8., 11:00");
    });
  });

  describe("rozsah ve stejném dni", () => {
    it("zobrazí datum jen jednou a konec jako čas", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-08-27T14:00", { ...CS, withYear: true })).toBe(
        "27.8.2026, 11:00 – 14:00",
      );
    });

    it("funguje i bez roku", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-08-27T14:00", CS)).toBe(
        "27.8., 11:00 – 14:00",
      );
    });

    it("scvrkne se na jediný údaj, když konec nemá čas", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-08-27", { ...CS, withYear: true })).toBe(
        "27.8.2026, 11:00",
      );
    });

    it("nechá celodenní začátek celodenní a přidá jen čas konce", () => {
      expect(formatDueDate("2026-08-27", "2026-08-27T14:00", { ...CS, withYear: true })).toBe(
        "27.8.2026 – 14:00",
      );
    });

    it("scvrkne se na jediné datum, když čas nemá ani jeden konec", () => {
      expect(formatDueDate("2026-08-27", "2026-08-27", { ...CS, withYear: true })).toBe(
        "27.8.2026",
      );
    });
  });

  describe("rozsah přes více dní", () => {
    it("vypíše oba konce celé", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-08-28T14:00", { ...CS, withYear: true })).toBe(
        "27.8.2026, 11:00 – 28.8.2026, 14:00",
      );
    });

    it("zvládne kombinaci s časem a bez času", () => {
      expect(formatDueDate("2026-08-27", "2026-08-30T14:00", { ...CS, withYear: true })).toBe(
        "27.8.2026 – 30.8.2026, 14:00",
      );
    });

    it("nespojí stejný den v jiném měsíci", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-09-27T14:00", { ...CS, withYear: true })).toBe(
        "27.8.2026, 11:00 – 27.9.2026, 14:00",
      );
    });

    it("nespojí stejný den a měsíc v jiném roce", () => {
      expect(formatDueDate("2026-08-27T11:00", "2027-08-27T14:00", { ...CS, withYear: true })).toBe(
        "27.8.2026, 11:00 – 27.8.2027, 14:00",
      );
    });
  });

  describe("popisek dne (Dnes)", () => {
    it("nahradí datum začátku popiskem a zachová rozsah časů", () => {
      expect(
        formatDueDate("2026-08-27T11:00", "2026-08-27T14:00", { ...CS, dayLabel: "Dnes" }),
      ).toBe("Dnes, 11:00 – 14:00");
    });

    it("zachová popisek u samotného času", () => {
      expect(formatDueDate("2026-08-27T11:00", null, { ...CS, dayLabel: "Dnes" })).toBe(
        "Dnes, 11:00",
      );
    });

    it("vypíše jen popisek, když termín nemá čas", () => {
      expect(formatDueDate("2026-08-27", null, { ...CS, dayLabel: "Dnes" })).toBe("Dnes");
    });

    it("vypíše jen popisek u celodenního rozsahu ve stejném dni", () => {
      expect(formatDueDate("2026-08-27", "2026-08-27", { ...CS, dayLabel: "Dnes" })).toBe("Dnes");
    });

    it("použije popisek i když čas má jen konec", () => {
      expect(formatDueDate("2026-08-27", "2026-08-27T14:00", { ...CS, dayLabel: "Dnes" })).toBe(
        "Dnes – 14:00",
      );
    });

    it("u víc-denního rozsahu popíše jen začátek", () => {
      expect(
        formatDueDate("2026-08-27T11:00", "2026-08-29T14:00", { ...CS, dayLabel: "Dnes" }),
      ).toBe("Dnes, 11:00 – 29.8., 14:00");
    });

    it("funguje i v angličtině", () => {
      expect(
        formatDueDate("2026-08-27T11:00", "2026-08-27T14:00", { ...EN, dayLabel: "Today" }),
      ).toBe("Today, 11:00 AM – 2:00 PM");
    });
  });

  describe("anglická lokalizace", () => {
    it("zkrátí rozsah ve stejném dni", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-08-27T14:00", { ...EN, withYear: true })).toBe(
        "Aug 27, 2026 11:00 AM – 2:00 PM",
      );
    });

    it("nechá rozsah přes více dní celý", () => {
      expect(formatDueDate("2026-08-27T11:00", "2026-08-28T14:00", EN)).toBe(
        "Aug 27, 11:00 AM – Aug 28, 2:00 PM",
      );
    });
  });
});

describe("formatTaskDate", () => {
  it("naformátuje datum bez času", () => {
    expect(formatTaskDate("2026-08-27", { ...CS, withYear: true })).toBe("27.8.2026");
  });

  it("naformátuje datum s časem", () => {
    expect(formatTaskDate("2026-08-27T09:05", CS)).toBe("27.8., 9:05");
  });

  it("respektuje popisek dne", () => {
    expect(formatTaskDate("2026-08-27", { ...CS, dayLabel: "Dnes" })).toBe("Dnes");
  });

  it("drží anglický formát beze změny", () => {
    expect(formatTaskDate("2026-08-27", { ...EN, withYear: true })).toBe("Aug 27, 2026");
  });
});
