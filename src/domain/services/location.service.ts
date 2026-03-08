import type { Location, CreateLocationInput, UpdateLocationInput } from "../entities/location";
import type { ILocationRepository } from "../repositories/location.repository";

export class LocationService {
  constructor(private readonly locationRepo: ILocationRepository) {}

  async getByUser(userId: string): Promise<Location[]> {
    return this.locationRepo.findByUser(userId);
  }

  async getById(id: string, userId: string): Promise<Location | undefined> {
    return this.locationRepo.findById(id, userId);
  }

  async create(userId: string, input: CreateLocationInput): Promise<Location> {
    return this.locationRepo.create({
      ...(input.id ? { id: input.id } : {}),
      userId,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address ?? null,
    });
  }

  async update(id: string, userId: string, input: UpdateLocationInput): Promise<Location> {
    const updates: Partial<Location> = {};
    if (input.name != null) updates.name = input.name;
    if (input.latitude != null) updates.latitude = input.latitude;
    if (input.longitude != null) updates.longitude = input.longitude;
    if (input.address !== undefined) updates.address = input.address ?? null;
    return this.locationRepo.update(id, userId, updates);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    await this.locationRepo.delete(id, userId);
    return true;
  }
}
