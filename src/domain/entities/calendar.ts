export interface VeventTaskData {
  icalUid: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  recurrence: string | null;
  isCompleted: boolean;
}
