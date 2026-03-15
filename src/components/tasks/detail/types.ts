export interface TaskStep {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface TaskLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string | null;
}

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
  location: TaskLocation | null;
  list: { id: string; name: string } | null;
}
