export type { TaskStep, TaskTag, TaskLocationInfo as TaskLocation } from "../types";
import type { TaskStep, TaskTag, TaskLocationInfo } from "../types";

export interface TaskDetail {
  id: string;
  listId: string;
  locationId: string | null;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  dueDate: string | null;
  dueDateEnd: string | null;
  reminderAt: string | null;
  recurrence: string | null;
  sortOrder: number;
  createdAt: string;
  steps: TaskStep[];
  tags: TaskTag[];
  location: TaskLocationInfo | null;
  list: { id: string; name: string } | null;
}
