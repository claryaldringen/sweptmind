export interface ShareNotification {
  type:
    | "task_shared"
    | "shared_field_changed"
    | "owner_completed"
    | "owner_deleted"
    | "invite_accepted";
  title: string;
  body: string;
  taskId?: string;
}

export interface INotificationSender {
  send(userId: string, notification: ShareNotification): Promise<void>;
}
