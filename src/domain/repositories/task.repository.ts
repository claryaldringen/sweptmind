import type { Task } from "../entities/task";

export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

export interface ITaskRepository {
  findById(id: string, userId: string): Promise<Task | undefined>;
  findByList(listId: string, userId: string, opts?: PaginationOpts): Promise<Task[]>;

  findPlanned(userId: string, opts?: PaginationOpts): Promise<Task[]>;
  findMaxSortOrder(listId: string): Promise<number | undefined>;
  findMinSortOrder(listId: string): Promise<number | undefined>;
  create(
    values: Partial<Task> & { userId: string; listId: string; title: string; sortOrder: number },
  ): Promise<Task>;
  update(id: string, userId: string, data: Partial<Task>): Promise<Task>;
  delete(id: string, userId: string): Promise<void>;
  updateSortOrder(id: string, userId: string, sortOrder: number): Promise<void>;
  countActiveByList(listId: string): Promise<number>;
  countActiveByListIds(listIds: string[]): Promise<Map<string, number>>;
  countVisibleByList(listId: string, today: string): Promise<number>;
  countVisibleByListIds(listIds: string[], today: string): Promise<Map<string, number>>;
  findByListId(listId: string, userId: string): Promise<Task[]>;
  findByTagId(tagId: string, userId: string): Promise<Task[]>;
  findWithLocation(userId: string, opts?: PaginationOpts): Promise<Task[]>;
  findContextTasks(
    userId: string,
    deviceContext: string | null,
    locationIds: string[],
  ): Promise<Task[]>;
}
