export interface UserConnection {
  id: string;
  userId: string;
  connectedUserId: string;
  targetListId: string | null;
  status: "active";
  createdAt: Date;
}

export interface ConnectionWithUser extends UserConnection {
  connectedUser: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  sharedTaskCount: number;
}
