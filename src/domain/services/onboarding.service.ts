import type { IListRepository } from "../repositories/list.repository";
import type { ILocationRepository } from "../repositories/location.repository";
import type { IUserRepository } from "../repositories/user.repository";

export interface OnboardingListInput {
  name: string;
  icon: string | null;
  deviceContext: string | null;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
  } | null;
}

export class OnboardingService {
  constructor(
    private readonly listRepo: IListRepository,
    private readonly locationRepo: ILocationRepository,
    private readonly userRepo: IUserRepository,
  ) {}

  async complete(userId: string, lists: OnboardingListInput[]): Promise<void> {
    for (const listInput of lists) {
      let locationId: string | null = null;

      if (listInput.location) {
        const location = await this.locationRepo.create({
          userId,
          name: listInput.location.name,
          latitude: listInput.location.latitude,
          longitude: listInput.location.longitude,
          address: listInput.location.address,
        });
        locationId = location.id;
      }

      const maxSort = await this.listRepo.findMaxSortOrder(userId);
      const sortOrder = (maxSort ?? -1) + 1;

      const list = await this.listRepo.create({
        userId,
        name: listInput.name,
        icon: listInput.icon,
        sortOrder,
      });

      if (listInput.deviceContext || locationId) {
        await this.listRepo.update(list.id, userId, {
          deviceContext: listInput.deviceContext,
          locationId,
        });
      }
    }

    await this.userRepo.updateOnboardingCompleted(userId, true);
  }

  async skip(userId: string): Promise<void> {
    await this.userRepo.updateOnboardingCompleted(userId, true);
  }
}
