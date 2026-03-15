export interface DecompositionStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

export interface CallIntent {
  name: string;
  reason: string | null;
}

export interface TaskAiAnalysis {
  id: string;
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  suggestedTitle: string | null;
  projectName: string | null;
  decomposition: DecompositionStep[] | null;
  duplicateTaskId: string | null;
  callIntent: CallIntent | null;
  analyzedTitle: string;
  createdAt: Date;
}

export interface CreateAiAnalysisInput {
  taskId: string;
  isActionable: boolean;
  suggestion: string | null;
  suggestedTitle: string | null;
  projectName: string | null;
  decomposition: DecompositionStep[] | null;
  duplicateTaskId: string | null;
  callIntent: CallIntent | null;
  analyzedTitle: string;
}
