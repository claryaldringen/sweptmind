import type { Tag } from "../entities/tag";

export interface ITagRepository {
  findByUser(userId: string): Promise<Tag[]>;
  findByTask(taskId: string): Promise<Tag[]>;
  findByTaskIds(taskIds: string[]): Promise<Map<string, Tag[]>>;
  findById(id: string, userId: string): Promise<Tag | undefined>;
  create(values: {
    userId: string;
    name: string;
    color: string;
    deviceContext?: string | null;
    locationId?: string | null;
  }): Promise<Tag>;
  update(id: string, userId: string, data: Partial<Tag>): Promise<Tag>;
  delete(id: string, userId: string): Promise<void>;
  addToTask(taskId: string, tagId: string): Promise<void>;
  removeFromTask(taskId: string, tagId: string): Promise<void>;
  countTasksByTag(tagId: string): Promise<number>;
  countTasksByTags(tagIds: string[]): Promise<Map<string, number>>;
}
