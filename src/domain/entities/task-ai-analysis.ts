export interface TaskAiAnalysis {
  id: string;
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  analyzedTitle: string;
  createdAt: Date;
}

export interface CreateAiAnalysisInput {
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  analyzedTitle: string;
}
