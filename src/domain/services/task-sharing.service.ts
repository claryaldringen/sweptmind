import type { SharedTask } from "../entities/shared-task";
import type { Task } from "../entities/task";
import type { ISharedTaskRepository } from "../repositories/shared-task.repository";
import type { IUserConnectionRepository } from "../repositories/user-connection.repository";
import type { ITaskRepository } from "../repositories/task.repository";
import type { IListRepository } from "../repositories/list.repository";
import type { IUserRepository } from "../repositories/user.repository";
import type { INotificationSender } from "../ports/notification-sender";

const SYNCED_FIELDS = ["dueDate", "dueDateEnd", "recurrence"] as const;

export class TaskSharingService {
  constructor(
    private readonly sharedTaskRepo: ISharedTaskRepository,
    private readonly connectionRepo: IUserConnectionRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly listRepo: IListRepository,
    private readonly userRepo: IUserRepository,
    private readonly notificationSender: INotificationSender,
  ) {}

  async shareTask(taskId: string, userId: string, targetUserId: string): Promise<SharedTask> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    const connection = await this.connectionRepo.findBetween(userId, targetUserId);
    if (!connection) throw new Error("Not connected with this user");

    // Resolve target list: per-connection > global default > default list
    const reverseConnection = await this.connectionRepo.findBetween(targetUserId, userId);
    let targetListId = reverseConnection?.targetListId ?? null;
    if (!targetListId) {
      const targetUser = await this.userRepo.findById(targetUserId);
      targetListId = targetUser?.sharingDefaultListId ?? null;
    }
    if (!targetListId) {
      const defaultList = await this.listRepo.findDefault(targetUserId);
      targetListId = defaultList?.id ?? null;
    }
    if (!targetListId) throw new Error("No target list available");

    const maxSort = await this.taskRepo.findMaxSortOrder(targetListId);
    const targetTask = await this.taskRepo.create({
      userId: targetUserId,
      listId: targetListId,
      title: task.title,
      dueDate: task.dueDate,
      dueDateEnd: task.dueDateEnd,
      recurrence: task.recurrence,
      sortOrder: (maxSort ?? 0) + 1,
    });

    const shared = await this.sharedTaskRepo.create(connection.id, taskId, targetTask.id);

    await this.notificationSender.send(targetUserId, {
      type: "task_shared",
      title: "New shared task",
      body: `A task was shared with you: "${task.title}"`,
      taskId: targetTask.id,
    });

    return shared;
  }

  async unshareTask(sharedTaskId: string, userId: string): Promise<void> {
    await this.sharedTaskRepo.delete(sharedTaskId);
  }

  async getShareInfo(taskId: string, userId: string): Promise<SharedTask[]> {
    return this.sharedTaskRepo.findBySourceTask(taskId);
  }

  async getShareSource(taskId: string, userId: string): Promise<SharedTask | undefined> {
    return this.sharedTaskRepo.findByTargetTask(taskId);
  }

  async syncSharedFields(taskId: string, updatedFields: Partial<Task>): Promise<void> {
    const changedSyncFields: Partial<Pick<Task, "dueDate" | "dueDateEnd" | "recurrence">> = {};
    for (const field of SYNCED_FIELDS) {
      if (field in updatedFields) {
        changedSyncFields[field] = updatedFields[field] as string | null;
      }
    }
    if (Object.keys(changedSyncFields).length === 0) return;

    const shares = await this.sharedTaskRepo.findBySourceTask(taskId);
    if (shares.length === 0) return;

    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (!targetTask) continue;

      await this.taskRepo.updateUnchecked(share.targetTaskId, changedSyncFields);

      await this.notificationSender.send(targetTask.userId, {
        type: "shared_field_changed",
        title: "Shared task updated",
        body: "A shared task's date was changed",
        taskId: share.targetTaskId,
      });
    }
  }

  async notifyOwnerAction(taskId: string, action: "completed" | "deleted"): Promise<void> {
    const shares = await this.sharedTaskRepo.findBySourceTask(taskId);

    for (const share of shares) {
      const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
      if (!targetTask) continue;

      await this.notificationSender.send(targetTask.userId, {
        type: action === "completed" ? "owner_completed" : "owner_deleted",
        title: action === "completed" ? "Shared task completed" : "Shared task deleted",
        body: `The owner ${action} a shared task`,
        taskId: share.targetTaskId,
      });
    }
  }
}
