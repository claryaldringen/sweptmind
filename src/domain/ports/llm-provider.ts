export interface LlmResponse {
  isActionable: boolean;
  suggestion: string | null;
}

export interface ILlmProvider {
  analyzeTask(title: string): Promise<LlmResponse>;
}
