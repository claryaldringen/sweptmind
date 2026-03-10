export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  deviceContext: string | null;
  locationId: string | null;
  locationRadius: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTagInput {
  id?: string | null;
  name: string;
  color?: string;
  deviceContext?: string | null;
  locationId?: string | null;
  locationRadius?: number | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  deviceContext?: string | null;
  locationId?: string | null;
  locationRadius?: number | null;
}
