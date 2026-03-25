export interface LlmAnalysisStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

export interface LlmCallIntent {
  name: string;
  reason: string | null;
}

export interface LlmShoppingItemSuggestion {
  action: "add_to_task" | "create_in_list";
  target: string;
  confidence: number;
  reason: string;
}

export interface LlmShoppingItem {
  stepTitle: string;
  suggestions: LlmShoppingItemSuggestion[];
}

export interface LlmResponse {
  isActionable: boolean;
  suggestion: string | null;
  suggestedTitle: string | null;
  projectName: string | null;
  steps: LlmAnalysisStep[] | null;
  duplicateTaskId: string | null;
  callIntent: LlmCallIntent | null;
  shoppingDistribution: LlmShoppingItem[] | null;
}

export interface LlmContext {
  lists: string[];
  tasks: { id: string; title: string }[];
  deviceContext: string | null;
  listName: string | null;
  steps: string[];
  completedTaskHistory: {
    title: string;
    listName: string;
    hadSteps: boolean;
    completedAt: string;
  }[];
}

export interface ILlmProvider {
  analyzeTask(
    title: string,
    locale: string,
    context: LlmContext,
    model?: string,
  ): Promise<LlmResponse>;
  /** Returns true if the provider has a valid API key / endpoint configured. */
  isConfigured(): boolean;
}
