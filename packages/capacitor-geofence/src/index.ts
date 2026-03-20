import { registerPlugin } from "@capacitor/core";
import type { GeofencePlugin } from "./definitions";

const Geofence = registerPlugin<GeofencePlugin>("Geofence", {
  web: () => import("./web").then((m) => new m.GeofenceWeb()),
});

export * from "./definitions";
export { Geofence };
