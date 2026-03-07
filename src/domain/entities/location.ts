export interface Location {
  id: string;
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLocationInput {
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
}

export interface UpdateLocationInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  address?: string | null;
}
