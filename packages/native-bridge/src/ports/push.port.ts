import type { PushRegistration, PushNotification } from "../types";

export interface PushPort {
  isSupported(): boolean;
  register(): Promise<PushRegistration>;
  unregister(): Promise<void>;
  onNotification(cb: (notification: PushNotification) => void): () => void;
}
