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
    const sharedTask = await this.sharedTaskRepo.findById(sharedTaskId);
    if (!sharedTask) throw new Error("Shared task not found");

    const sourceTask = await this.taskRepo.findById(sharedTask.sourceTaskId, userId);
    if (!sourceTask) throw new Error("Not authorized to unshare this task");

    await this.sharedTaskRepo.delete(sharedTaskId);
  }

  async getShareInfo(taskId: string, userId: string): Promise<SharedTask[]> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    return this.sharedTaskRepo.findBySourceTask(taskId);
  }

  async getShareSource(taskId: string, userId: string): Promise<SharedTask | undefined> {
    const task = await this.taskRepo.findById(taskId, userId);
    if (!task) throw new Error("Task not found");

    return this.sharedTaskRepo.findByTargetTask(taskId);
  }

  async getTaskUnchecked(taskId: string): Promise<Task | undefined> {
    return this.taskRepo.findByIdUnchecked(taskId);
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

  async evaluateCompletionRule(taskId: string, userId: string): Promise<void> {
    // Determine if this task is a source or target of a share
    const shareAsTarget = await this.sharedTaskRepo.findByTargetTask(taskId);

    // Find the source task (the one with the rules)
    const sourceTaskId = shareAsTarget ? shareAsTarget.sourceTaskId : taskId;
    const shares = shareAsTarget
      ? await this.sharedTaskRepo.findBySourceTask(sourceTaskId)
      : await this.sharedTaskRepo.findBySourceTask(taskId);

    if (shares.length === 0) return; // Not a shared task

    const sourceTask = await this.taskRepo.findByIdUnchecked(sourceTaskId);
    if (!sourceTask) return;
    if (!sourceTask.shareCompletionMode) return; // No rule configured

    const mode = sourceTask.shareCompletionMode;
    const action = sourceTask.shareCompletionAction ?? "complete";

    // Check if condition is met
    if (mode === "all") {
      // Check source task
      if (!sourceTask.isCompleted) return;
      // Check all target tasks
      for (const share of shares) {
        const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
        if (targetTask && !targetTask.isCompleted) return;
      }
    }
    // mode === "any" — condition already met (someone just toggled complete)

    // Execute action
    if (action === "complete") {
      if (!sourceTask.isCompleted) {
        await this.taskRepo.updateUnchecked(sourceTaskId, {
          isCompleted: true,
          completedAt: new Date(),
        });
      }
      for (const share of shares) {
        const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
        if (targetTask && !targetTask.isCompleted) {
          await this.taskRepo.updateUnchecked(share.targetTaskId, {
            isCompleted: true,
            completedAt: new Date(),
          });
        }
      }
    } else if (action === "move" && sourceTask.shareCompletionListId) {
      if (!sourceTask.isCompleted) {
        await this.taskRepo.updateUnchecked(sourceTaskId, {
          listId: sourceTask.shareCompletionListId,
          isCompleted: true,
          completedAt: new Date(),
        });
      } else {
        await this.taskRepo.updateUnchecked(sourceTaskId, {
          listId: sourceTask.shareCompletionListId,
        });
      }
      for (const share of shares) {
        const targetTask = await this.taskRepo.findByIdUnchecked(share.targetTaskId);
        if (targetTask && !targetTask.isCompleted) {
          await this.taskRepo.updateUnchecked(share.targetTaskId, {
            isCompleted: true,
            completedAt: new Date(),
          });
        }
      }
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
