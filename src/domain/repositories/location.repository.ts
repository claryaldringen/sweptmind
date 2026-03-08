import type { Location } from "../entities/location";

export interface ILocationRepository {
  findByUser(userId: string): Promise<Location[]>;
  findById(id: string, userId: string): Promise<Location | undefined>;
  findByIds(ids: string[], userId: string): Promise<Location[]>;
  create(values: {
    id?: string;
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    address?: string | null;
  }): Promise<Location>;
  update(id: string, userId: string, data: Partial<Location>): Promise<Location>;
  delete(id: string, userId: string): Promise<void>;
}
