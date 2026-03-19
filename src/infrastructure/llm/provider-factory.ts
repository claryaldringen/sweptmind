import type { ILlmProvider } from "@/domain/ports/llm-provider";
import type { ILlmProviderFactory } from "@/domain/services/ai.service";
import { OpenAiCompatibleProvider } from "./openai-compatible-provider";
import { OllamaProvider } from "./ollama-provider";

export class LlmProviderFactory implements ILlmProviderFactory {
  create(config: {
    provider: string;
    apiKey: string;
    baseUrl?: string | null;
    model?: string | null;
  }): ILlmProvider {
    if (config.provider === "ollama") {
      return new OllamaProvider(config.baseUrl || undefined, config.model || undefined);
    }
    return new OpenAiCompatibleProvider(
      config.apiKey,
      config.baseUrl || undefined,
      config.model || undefined,
    );
  }
}
