import type { List } from "../entities/list";

export interface IListRepository {
  findById(id: string, userId: string): Promise<List | undefined>;
  findByIds(ids: string[], userId: string): Promise<List[]>;
  findByUser(userId: string): Promise<List[]>;
  findByGroup(groupId: string): Promise<List[]>;
  findMaxSortOrder(userId: string): Promise<number | undefined>;
  create(
    values: Partial<List> & { userId: string; name: string; sortOrder: number },
  ): Promise<List>;
  update(id: string, userId: string, data: Partial<List>): Promise<List>;
  deleteNonDefault(id: string, userId: string): Promise<void>;
  updateSortOrder(id: string, userId: string, sortOrder: number): Promise<void>;
  ungroupByGroupId(groupId: string): Promise<void>;
  deleteManyNonDefault(ids: string[], userId: string): Promise<void>;
}
