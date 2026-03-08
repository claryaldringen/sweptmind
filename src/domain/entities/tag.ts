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
  id?: string | null;
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
