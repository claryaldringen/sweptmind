import { describe, it, expect } from "vitest";
import { haversineDistance, isNearby, DEFAULT_RADIUS_KM } from "../geo";

describe("haversineDistance", () => {
  it("vrátí 0 pro stejný bod", () => {
    expect(haversineDistance(50.0, 14.0, 50.0, 14.0)).toBe(0);
  });

  it("vypočítá správnou vzdálenost Praha - Beroun (~30 km)", () => {
    const distance = haversineDistance(50.0755, 14.4378, 49.9637, 14.0722);
    expect(distance).toBeGreaterThan(25);
    expect(distance).toBeLessThan(35);
  });

  it("vypočítá krátkou vzdálenost (~1 km)", () => {
    // Dva body blízko sebe v Praze
    const distance = haversineDistance(50.08, 14.42, 50.089, 14.42);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(2);
  });

  it("vypočítá maximální vzdálenost pro antipodální body (~20015 km)", () => {
    // Severní pól → Jižní pól
    const distance = haversineDistance(90, 0, -90, 0);
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(20100);
  });

  it("vypočítá vzdálenost přes datovou hranici (180° poledník)", () => {
    // Bod na +179° a -179° by měly být blízko sebe (~222 km na rovníku)
    const distance = haversineDistance(0, 179, 0, -179);
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(250);
  });

  it("je symetrická (vzdálenost A→B = B→A)", () => {
    const d1 = haversineDistance(50.0755, 14.4378, 49.9637, 14.0722);
    const d2 = haversineDistance(49.9637, 14.0722, 50.0755, 14.4378);
    expect(d1).toBeCloseTo(d2, 10);
  });
});

describe("isNearby", () => {
  it("vrátí true pro bod v okruhu 5 km", () => {
    // Dva body ~2 km od sebe
    expect(isNearby(50.08, 14.42, 50.098, 14.42)).toBe(true);
  });

  it("vrátí false pro vzdálený bod", () => {
    // Praha - Beroun (~30 km)
    expect(isNearby(50.0755, 14.4378, 49.9637, 14.0722)).toBe(false);
  });

  it("vrátí true pro stejný bod", () => {
    expect(isNearby(50.0, 14.0, 50.0, 14.0)).toBe(true);
  });

  it("vrátí true pro bod přesně na hranici 5 km", () => {
    // Najdeme bod přesně 5 km severně od referenčního bodu na rovníku
    // 5 km na rovníku odpovídá přibližně 0.04496° zeměpisné šířky
    const baseLat = 0;
    const baseLon = 0;
    // 5 km / 6371 km * (180/π) ≈ 0.04496°
    const offsetLat = (5 / 6371) * (180 / Math.PI);
    const targetLat = baseLat + offsetLat;

    // Vzdálenost by měla být přesně 5 km, tedy isNearby vrátí true (<=)
    expect(isNearby(baseLat, baseLon, targetLat, baseLon)).toBe(true);
  });

  it("vrátí false pro bod těsně za hranicí 5 km", () => {
    const baseLat = 0;
    const baseLon = 0;
    // 5.01 km severně
    const offsetLat = (5.01 / 6371) * (180 / Math.PI);
    const targetLat = baseLat + offsetLat;

    expect(isNearby(baseLat, baseLon, targetLat, baseLon)).toBe(false);
  });
});

describe("DEFAULT_RADIUS_KM", () => {
  it("je 5 km", () => {
    expect(DEFAULT_RADIUS_KM).toBe(5);
  });
});

describe("isNearby s vlastním radiusem", () => {
  it("vrátí true pro bod v okruhu 10 km", () => {
    // Praha - bod ~8 km daleko
    const offsetLat = (8 / 6371) * (180 / Math.PI);
    expect(isNearby(50.0, 14.0, 50.0 + offsetLat, 14.0, 10)).toBe(true);
  });

  it("vrátí false pro bod mimo vlastní radius 2 km", () => {
    // Dva body ~3 km od sebe
    const offsetLat = (3 / 6371) * (180 / Math.PI);
    expect(isNearby(50.0, 14.0, 50.0 + offsetLat, 14.0, 2)).toBe(false);
  });
});
