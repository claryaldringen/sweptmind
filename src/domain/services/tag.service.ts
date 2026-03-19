import type { Tag, CreateTagInput, UpdateTagInput } from "../entities/tag";
import type { ITagRepository } from "../repositories/tag.repository";
import type { ITaskRepository } from "../repositories/task.repository";

export class TagService {
  constructor(
    private readonly tagRepo: ITagRepository,
    private readonly taskRepo: ITaskRepository,
  ) {}

  async getByUser(userId: string): Promise<Tag[]> {
    return this.tagRepo.findByUser(userId);
  }

  async getByTask(taskId: string): Promise<Tag[]> {
    return this.tagRepo.findByTask(taskId);
  }

  async getById(id: string, userId: string): Promise<Tag | undefined> {
    return this.tagRepo.findById(id, userId);
  }

  async create(userId: string, input: CreateTagInput): Promise<Tag> {
    return this.tagRepo.create({
      ...(input.id ? { id: input.id } : {}),
      userId,
      name: input.name,
      color: input.color ?? "blue",
      deviceContext: input.deviceContext ?? null,
      locationId: input.locationId ?? null,
      locationRadius: input.locationRadius ?? null,
    });
  }

  async update(id: string, userId: string, input: UpdateTagInput): Promise<Tag> {
    const updates: Partial<Tag> = {};
    if (input.name != null) updates.name = input.name;
    if (input.color != null) updates.color = input.color;
    if (input.deviceContext !== undefined) updates.deviceContext = input.deviceContext ?? null;
    if (input.locationId !== undefined) updates.locationId = input.locationId ?? null;
    if (input.locationRadius !== undefined) updates.locationRadius = input.locationRadius ?? null;
    return this.tagRepo.update(id, userId, updates);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    await this.tagRepo.delete(id, userId);
    return true;
  }

  async addToTask(taskId: string, tagId: string, userId: string): Promise<boolean> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");
    const tag = await this.tagRepo.findById(tagId, userId);
    if (!tag) throw new Error("Tag not found");
    await this.tagRepo.addToTask(taskId, tagId);
    return true;
  }

  async removeFromTask(taskId: string, tagId: string, userId: string): Promise<boolean> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");
    await this.tagRepo.removeFromTask(taskId, tagId);
    return true;
  }

  async countTasksByTag(tagId: string): Promise<number> {
    return this.tagRepo.countTasksByTag(tagId);
  }

  async getTasksByTag(tagId: string, userId: string): Promise<import("../entities/task").Task[]> {
    const tag = await this.tagRepo.findById(tagId, userId);
    if (!tag) throw new Error("Tag not found");
    return this.taskRepo.findByTagId(tagId, userId);
  }
}
