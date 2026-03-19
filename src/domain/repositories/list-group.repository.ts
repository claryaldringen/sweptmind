import type { ListGroup } from "../entities/list";

export interface IListGroupRepository {
  findByUser(userId: string): Promise<ListGroup[]>;
  findMaxSortOrder(userId: string): Promise<number | undefined>;
  create(values: { userId: string; name: string; sortOrder: number }): Promise<ListGroup>;
  update(id: string, userId: string, data: Partial<ListGroup>): Promise<ListGroup>;
  delete(id: string, userId: string): Promise<void>;
}
