export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  notifyDueDate: boolean;
  notifyReminder: boolean;
  createdAt: Date;
}

export type PushPlatform = "web" | "ios" | "android";

export interface SubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: PushPlatform;
  notifyDueDate: boolean;
  notifyReminder: boolean;
}

export interface PushPreferences {
  notifyDueDate: boolean;
  notifyReminder: boolean;
}
