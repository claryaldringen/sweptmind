export interface LlmResponse {
  isActionable: boolean;
  suggestion: string | null;
}

export interface DecomposeStep {
  title: string;
  listName: string | null;
  dependsOn: number | null;
}

export interface DecomposeResponse {
  projectName: string;
  steps: DecomposeStep[];
}

export interface ILlmProvider {
  analyzeTask(title: string): Promise<LlmResponse>;
  decomposeTask(title: string, context: { lists: string[]; tags: string[] }): Promise<DecomposeResponse>;
}
