import type { ListGroup } from "../entities/list";
import type { IListGroupRepository } from "../repositories/list-group.repository";
import type { IListRepository } from "../repositories/list.repository";

export class ListGroupService {
  constructor(
    private readonly groupRepo: IListGroupRepository,
    private readonly listRepo: IListRepository,
  ) {}

  async getByUser(userId: string): Promise<ListGroup[]> {
    return this.groupRepo.findByUser(userId);
  }

  async create(userId: string, name: string): Promise<ListGroup> {
    const maxSort = await this.groupRepo.findMaxSortOrder(userId);
    const sortOrder = (maxSort ?? -1) + 1;

    return this.groupRepo.create({ userId, name, sortOrder });
  }

  async update(id: string, userId: string, name: string): Promise<ListGroup> {
    return this.groupRepo.update(id, userId, { name });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    await this.listRepo.ungroupByGroupId(id);
    await this.groupRepo.delete(id, userId);
    return true;
  }
}
