export interface ConnectionInvite {
  id: string;
  fromUserId: string;
  taskId: string | null;
  token: string;
  status: "pending" | "accepted" | "expired";
  acceptedByUserId: string | null;
  expiresAt: Date;
  createdAt: Date;
}
