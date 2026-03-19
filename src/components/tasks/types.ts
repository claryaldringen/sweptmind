export interface TaskTag {
  id: string;
  name: string;
  color: string;
}

export interface TaskLocationInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string | null;
}

export interface TaskStep {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface TaskAttachment {
  id: string;
}

export interface TaskAiAnalysis {
  isActionable: boolean;
  suggestion: string | null;
  suggestedTitle?: string | null;
  decomposition?: { title: string }[] | null;
  duplicateTaskId?: string | null;
  callIntent?: { name: string } | null;
  analyzedTitle: string;
}

/**
 * Shared Task type used by task list components (task-item, task-list,
 * sortable-task-list, sortable-task-item, draggable-task-item).
 *
 * This is the union of all fields consumed across those components.
 * Fields that are only used by some components are marked optional so
 * simpler wrappers can pass through the same object without narrowing.
 *
 * AppTask (from app-data-provider) is a strict superset and is always
 * assignable to this type.
 */
export interface Task {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate: string | null;
  dueDateEnd?: string | null;
  reminderAt: string | null;
  recurrence?: string | null;
  deviceContext?: string | null;
  sortOrder?: number;
  locationId?: string | null;
  locationRadius?: number | null;
  location?: TaskLocationInfo | null;
  list?: { id: string; name: string } | null;
  steps?: { id: string; isCompleted: boolean }[];
  tags?: TaskTag[];
  blockedByTaskId?: string | null;
  blockedByTaskIsCompleted?: boolean | null;
  dependentTaskCount?: number;
  isGoogleCalendarEvent?: boolean;
  attachments?: TaskAttachment[];
  aiAnalysis?: TaskAiAnalysis | null;
  isSharedTo?: boolean;
  isSharedFrom?: boolean;
}
