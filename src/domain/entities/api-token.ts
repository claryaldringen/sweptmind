export interface ApiToken {
  id: string;
  userId: string;
  tokenHash: string;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface CreateApiTokenInput {
  userId: string;
  tokenHash: string;
  name: string;
}
