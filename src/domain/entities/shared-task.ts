export interface SharedTask {
  id: string;
  connectionId: string;
  sourceTaskId: string;
  targetTaskId: string;
  createdAt: Date;
}
