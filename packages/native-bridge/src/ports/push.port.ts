import type { PushRegistration, PushNotification, PushPermissionStatus } from "../types";

export interface PushPort {
  isSupported(): boolean;
  /** False when this build can't receive push (e.g. Android app built without Firebase config). */
  isConfigured(): Promise<boolean>;
  getPermissionStatus(): Promise<PushPermissionStatus>;
  /**
   * Asks for permission if needed, registers with the push service and returns the token.
   * `androidChannelName` labels the notification channel in Android settings.
   */
  register(options?: { androidChannelName?: string }): Promise<PushRegistration>;
  unregister(): Promise<void>;
  onNotification(cb: (notification: PushNotification) => void): () => void;
  /** Fires on every (re)registration — including token rotation by the push service. */
  onTokenChange(cb: (registration: PushRegistration) => void): () => void;
  /** Fires when the user taps a notification; receives its data payload. */
  onNotificationOpened(cb: (data: Record<string, string>) => void): () => void;
}
