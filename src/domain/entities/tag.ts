export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  deviceContext: string | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  deviceContext?: string | null;
  locationId?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  deviceContext?: string | null;
  locationId?: string | null;
}
