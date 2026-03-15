import type { Step } from "../entities/task";
import type { IStepRepository } from "../repositories/step.repository";
import type { ITaskRepository } from "../repositories/task.repository";

export class StepService {
  constructor(
    private readonly stepRepo: IStepRepository,
    private readonly taskRepo: ITaskRepository,
  ) {}

  async getByTask(taskId: string): Promise<Step[]> {
    return this.stepRepo.findByTask(taskId);
  }

  async create(userId: string, taskId: string, title: string, id?: string): Promise<Step> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    const maxSort = await this.stepRepo.findMaxSortOrder(taskId);
    const sortOrder = (maxSort ?? -1) + 1;

    return this.stepRepo.create({ ...(id ? { id } : {}), taskId, title, sortOrder });
  }

  async update(userId: string, id: string, title: string): Promise<Step> {
    const step = await this.stepRepo.findById(id);
    if (!step) throw new Error("Step not found");
    const task = await this.taskRepo.findById(step.taskId, userId);
    if (!task) throw new Error("Step not found");
    return this.stepRepo.update(id, { title });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const step = await this.stepRepo.findById(id);
    if (!step) throw new Error("Step not found");
    const task = await this.taskRepo.findById(step.taskId, userId);
    if (!task) throw new Error("Step not found");
    await this.stepRepo.delete(id);
    return true;
  }

  async deleteMany(userId: string, ids: string[]): Promise<boolean> {
    for (const id of ids) {
      const step = await this.stepRepo.findById(id);
      if (!step) throw new Error("Step not found");
      const task = await this.taskRepo.findById(step.taskId, userId);
      if (!task) throw new Error("Step not found");
    }
    await this.stepRepo.deleteMany(ids);
    return true;
  }

  async toggleCompleted(userId: string, id: string): Promise<Step> {
    const step = await this.stepRepo.findById(id);
    if (!step) throw new Error("Step not found");
    const task = await this.taskRepo.findById(step.taskId, userId);
    if (!task) throw new Error("Step not found");
    return this.stepRepo.update(id, { isCompleted: !step.isCompleted });
  }
}
