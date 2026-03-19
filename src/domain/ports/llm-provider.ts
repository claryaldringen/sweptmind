export interface LlmAnalysisStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

export interface LlmCallIntent {
  name: string;
  reason: string | null;
}

export interface LlmResponse {
  isActionable: boolean;
  suggestion: string | null;
  suggestedTitle: string | null;
  projectName: string | null;
  steps: LlmAnalysisStep[] | null;
  duplicateTaskId: string | null;
  callIntent: LlmCallIntent | null;
}

export interface LlmContext {
  lists: string[];
  tasks: { id: string; title: string }[];
  deviceContext: string | null;
  listName: string | null;
}

export interface ILlmProvider {
  analyzeTask(title: string, locale: string, context: LlmContext): Promise<LlmResponse>;
}
