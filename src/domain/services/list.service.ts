import type { List } from "../entities/list";
import type { CreateListInput, UpdateListInput, ReorderItem } from "../entities/list";
import type { IListRepository } from "../repositories/list.repository";

export class ListService {
  constructor(private readonly listRepo: IListRepository) {}

  async getById(id: string, userId: string): Promise<List | undefined> {
    return this.listRepo.findById(id, userId);
  }

  async getByUser(userId: string): Promise<List[]> {
    return this.listRepo.findByUser(userId);
  }

  async getByGroup(groupId: string): Promise<List[]> {
    return this.listRepo.findByGroup(groupId);
  }

  async create(userId: string, input: CreateListInput): Promise<List> {
    const maxSort = await this.listRepo.findMaxSortOrder(userId);
    const sortOrder = (maxSort ?? -1) + 1;

    return this.listRepo.create({
      userId,
      name: input.name,
      icon: input.icon ?? null,
      themeColor: input.themeColor ?? null,
      groupId: input.groupId ?? null,
      sortOrder,
    });
  }

  async update(id: string, userId: string, input: UpdateListInput): Promise<List> {
    const updates: Partial<List> = {};
    if (input.name != null) updates.name = input.name;
    if (input.icon !== undefined) updates.icon = input.icon ?? null;
    if (input.themeColor !== undefined) updates.themeColor = input.themeColor ?? null;
    if (input.groupId !== undefined) updates.groupId = input.groupId ?? null;
    if (input.locationId !== undefined) updates.locationId = input.locationId ?? null;
    if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;

    return this.listRepo.update(id, userId, updates);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    await this.listRepo.deleteNonDefault(id, userId);
    return true;
  }

  async reorder(userId: string, items: ReorderItem[]): Promise<boolean> {
    for (const item of items) {
      await this.listRepo.updateSortOrder(item.id, userId, item.sortOrder);
    }
    return true;
  }

  async createDefaultList(userId: string): Promise<List> {
    return this.listRepo.create({
      userId,
      name: "Tasks",
      isDefault: true,
      sortOrder: 0,
    });
  }
}
