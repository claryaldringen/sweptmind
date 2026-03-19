/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn(),
  },
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    addWatcher: vi.fn(),
    removeWatcher: vi.fn(),
  })),
}));

import { CapacitorLocationAdapter } from "../adapters/capacitor/capacitor-location.adapter";
import { Geolocation } from "@capacitor/geolocation";

describe("CapacitorLocationAdapter", () => {
  let adapter: CapacitorLocationAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorLocationAdapter();
  });

  it("isSupported returns true", () => {
    expect(adapter.isSupported()).toBe(true);
  });

  it("getCurrentPosition returns coordinates", async () => {
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
      coords: {
        latitude: 50.08,
        longitude: 14.42,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });

    const pos = await adapter.getCurrentPosition();
    expect(pos.latitude).toBe(50.08);
    expect(pos.longitude).toBe(14.42);
  });

  it("manages geofences", async () => {
    const events: any[] = [];
    adapter.onGeofenceEvent((e) => events.push(e));

    await adapter.addGeofence({
      id: "home",
      latitude: 50.08,
      longitude: 14.42,
      radiusKm: 0.5,
    });

    // Access private method via any cast for testing
    (adapter as any).checkGeofences({ latitude: 50.08, longitude: 14.42 });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("enter");
    expect(events[0].fenceId).toBe("home");

    // Same position — no new event
    (adapter as any).checkGeofences({ latitude: 50.08, longitude: 14.42 });
    expect(events).toHaveLength(1);

    // Far away — exit event
    (adapter as any).checkGeofences({ latitude: 51.0, longitude: 15.0 });
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe("exit");
  });

  it("removes geofences", async () => {
    await adapter.addGeofence({
      id: "work",
      latitude: 50.1,
      longitude: 14.5,
      radiusKm: 1,
    });
    await adapter.removeGeofence("work");

    const events: any[] = [];
    adapter.onGeofenceEvent((e) => events.push(e));
    (adapter as any).checkGeofences({ latitude: 50.1, longitude: 14.5 });
    expect(events).toHaveLength(0);
  });
});
