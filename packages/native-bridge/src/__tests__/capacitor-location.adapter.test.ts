import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGeofence = {
  setGeofences: vi.fn().mockResolvedValue(undefined),
  addGeofences: vi.fn().mockResolvedValue(undefined),
  removeGeofences: vi.fn().mockResolvedValue(undefined),
  removeAllGeofences: vi.fn().mockResolvedValue(undefined),
  getMonitoredGeofences: vi.fn().mockResolvedValue({ geofences: [] }),
  requestAlwaysPermission: vi
    .fn()
    .mockResolvedValue({ status: "always", notifications: "granted" }),
  getPermissionStatus: vi.fn().mockResolvedValue({ status: "whenInUse", notifications: "denied" }),
  openAppSettings: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  removeAllListeners: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn(),
  },
}));

vi.mock("@sweptmind/capacitor-geofence", () => ({
  Geofence: mockGeofence,
}));

const mockPlatform = vi.hoisted(() => ({ value: "ios" }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => mockPlatform.value },
}));

import { CapacitorLocationAdapter } from "../adapters/capacitor/capacitor-location.adapter";
import { Geolocation } from "@capacitor/geolocation";

describe("CapacitorLocationAdapter", () => {
  let adapter: CapacitorLocationAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorLocationAdapter();
    mockPlatform.value = "ios";
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
        magneticHeading: null,
        trueHeading: null,
        headingAccuracy: null,
        course: null,
      },
      timestamp: Date.now(),
    });

    const pos = await adapter.getCurrentPosition();
    expect(pos.latitude).toBe(50.08);
    expect(pos.longitude).toBe(14.42);
  });

  it("addGeofence delegates to native plugin", async () => {
    await adapter.addGeofence({
      id: "home",
      latitude: 50.08,
      longitude: 14.42,
      radiusKm: 0.5,
      name: "Home",
    });

    expect(mockGeofence.addGeofences).toHaveBeenCalledWith({
      geofences: [
        {
          identifier: "home",
          latitude: 50.08,
          longitude: 14.42,
          radiusMeters: 500,
          notifyOnEntry: true,
          notifyOnExit: false,
          notificationTitle: "Home",
        },
      ],
    });
  });

  it("addGeofence enforces minimum 200m radius", async () => {
    await adapter.addGeofence({
      id: "tiny",
      latitude: 50.08,
      longitude: 14.42,
      radiusKm: 0.05, // 50m — below minimum
    });

    expect(mockGeofence.addGeofences).toHaveBeenCalledWith({
      geofences: [
        expect.objectContaining({
          radiusMeters: 200,
        }),
      ],
    });
  });

  it("removeGeofence delegates to native plugin", async () => {
    await adapter.removeGeofence("work");
    expect(mockGeofence.removeGeofences).toHaveBeenCalledWith({
      identifiers: ["work"],
    });
  });

  it("syncGeofences on Android replaces geofences atomically", async () => {
    mockPlatform.value = "android";
    await adapter.syncGeofences([
      {
        identifier: "location:abc:500",
        latitude: 50.0,
        longitude: 14.0,
        radiusMeters: 500,
        notificationTitle: "Office",
        notificationBody: "Buy coffee",
        notificationUrl: "/context",
      },
    ]);

    expect(mockGeofence.removeAllGeofences).not.toHaveBeenCalled();
    expect(mockGeofence.setGeofences).toHaveBeenCalledWith({
      geofences: [
        {
          identifier: "location:abc:500",
          latitude: 50.0,
          longitude: 14.0,
          radiusMeters: 500,
          notifyOnEntry: true,
          notifyOnExit: false,
          notificationTitle: "Office",
          notificationBody: "Buy coffee",
          notificationUrl: "/context",
        },
      ],
    });
  });

  it("syncGeofences on iOS removes all and adds new", async () => {
    await adapter.syncGeofences([
      {
        identifier: "location:abc",
        latitude: 50.0,
        longitude: 14.0,
        radiusMeters: 500,
        notificationTitle: "Office",
        notificationBody: "Buy coffee",
      },
    ]);

    expect(mockGeofence.removeAllGeofences).toHaveBeenCalled();
    expect(mockGeofence.addGeofences).toHaveBeenCalledWith({
      geofences: [
        {
          identifier: "location:abc",
          latitude: 50.0,
          longitude: 14.0,
          radiusMeters: 500,
          notifyOnEntry: true,
          notifyOnExit: false,
          notificationTitle: "Office",
          notificationBody: "Buy coffee",
        },
      ],
    });
  });

  it("syncGeofences with empty array only removes", async () => {
    await adapter.syncGeofences([]);
    expect(mockGeofence.removeAllGeofences).toHaveBeenCalled();
    expect(mockGeofence.addGeofences).not.toHaveBeenCalled();
  });

  it("requestAlwaysPermission delegates to native plugin", async () => {
    const result = await adapter.requestAlwaysPermission();
    expect(result).toEqual({ location: "always", notifications: "granted" });
    expect(mockGeofence.requestAlwaysPermission).toHaveBeenCalled();
  });

  it("getPermissionStatus delegates to native plugin", async () => {
    const result = await adapter.getPermissionStatus();
    expect(result).toEqual({ location: "whenInUse", notifications: "denied" });
    expect(mockGeofence.getPermissionStatus).toHaveBeenCalled();
  });

  it("openAppSettings opens system settings only on Android", async () => {
    await adapter.openAppSettings();
    expect(mockGeofence.openAppSettings).not.toHaveBeenCalled();

    mockPlatform.value = "android";
    await adapter.openAppSettings();
    expect(mockGeofence.openAppSettings).toHaveBeenCalled();
  });

  it("onNotificationOpened forwards the tapped notification URL", async () => {
    const cb = vi.fn();
    adapter.onNotificationOpened(cb);

    await vi.waitFor(() => {
      expect(mockGeofence.addListener).toHaveBeenCalledWith(
        "notificationOpened",
        expect.any(Function),
      );
    });
    const handler = mockGeofence.addListener.mock.calls[0][1];
    handler({ url: "/context" });
    expect(cb).toHaveBeenCalledWith("/context");
  });

  it("onGeofenceEvent sets up native listener", async () => {
    const cb = vi.fn();
    const unsub = adapter.onGeofenceEvent(cb);

    // setupNativeListener is async — wait for it to complete
    await vi.waitFor(() => {
      expect(mockGeofence.addListener).toHaveBeenCalledWith(
        "geofenceTransition",
        expect.any(Function),
      );
    });
    expect(typeof unsub).toBe("function");
  });

  it("startBackgroundTracking is no-op", async () => {
    await adapter.startBackgroundTracking({
      intervalMs: 60000,
      distanceFilterMeters: 100,
    });
    // Should not throw or call any native methods
  });

  it("stopBackgroundTracking is no-op", async () => {
    await adapter.stopBackgroundTracking();
    // Should not throw
  });

  it("removeAllGeofences delegates to native plugin", async () => {
    await adapter.removeAllGeofences();
    expect(mockGeofence.removeAllGeofences).toHaveBeenCalled();
  });
});
