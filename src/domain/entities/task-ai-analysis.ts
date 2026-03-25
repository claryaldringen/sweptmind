export interface DecompositionStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

export interface CallIntent {
  name: string;
  reason: string | null;
}

export interface ShoppingItemSuggestion {
  action: "add_to_task" | "create_in_list";
  target: string;
  targetId: string | null;
  confidence: number;
  reason: string;
}

export interface ShoppingItem {
  stepId: string | null;
  stepTitle: string;
  suggestions: ShoppingItemSuggestion[];
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
  shoppingDistribution: ShoppingItem[] | null;
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
  shoppingDistribution: ShoppingItem[] | null;
  analyzedTitle: string;
}
