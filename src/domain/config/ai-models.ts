export interface AiModelConfig {
  id: string;
  label: string;
  monthlyLimit: number;
}

export const AI_MODELS: AiModelConfig[] = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini", monthlyLimit: 500 },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", monthlyLimit: 200 },
  { id: "gpt-4.1", label: "GPT-4.1", monthlyLimit: 50 },
];

export const DEFAULT_AI_MODEL = "gpt-4o-mini";

export function getModelConfig(modelId: string | null): AiModelConfig {
  return AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0];
}

export function isValidModel(modelId: string): boolean {
  return AI_MODELS.some((m) => m.id === modelId);
}
