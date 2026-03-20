export interface Task {
  id: string;
  userId: string;
  listId: string;
  locationId: string | null;
  locationRadius: number | null;
  title: string;
  notes: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  dueDate: string | null;
  dueDateEnd: string | null;
  reminderAt: string | null;
  recurrence: string | null;
  deviceContext: string | null;
  blockedByTaskId: string | null;
  shareCompletionMode: string | null;
  shareCompletionAction: string | null;
  shareCompletionListId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Step {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface CreateTaskInput {
  id?: string | null;
  listId: string;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  dueDateEnd?: string | null;
  locationId?: string | null;
  locationRadius?: number | null;
  deviceContext?: string | null;
}

export interface UpdateTaskInput {
  title?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  dueDateEnd?: string | null;
  reminderAt?: string | null;
  recurrence?: string | null;
  listId?: string | null;
  locationId?: string | null;
  locationRadius?: number | null;
  deviceContext?: string | null;
  blockedByTaskId?: string | null;
  shareCompletionMode?: string | null;
  shareCompletionAction?: string | null;
  shareCompletionListId?: string | null;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}
