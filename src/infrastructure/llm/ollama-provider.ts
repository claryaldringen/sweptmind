import type { ILlmProvider, LlmResponse } from "@/domain/ports/llm-provider";
import { GTD_SYSTEM_PROMPT } from "./system-prompt";

export class OllamaProvider implements ILlmProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model = process.env.OLLAMA_MODEL || "llama3.1",
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async analyzeTask(title: string): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: GTD_SYSTEM_PROMPT },
          { role: "user", content: title },
        ],
        stream: false,
        format: "json",
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.message?.content;
    if (!content) {
      throw new Error("Empty response from Ollama");
    }

    const parsed = JSON.parse(content);
    return {
      isActionable: Boolean(parsed.isActionable),
      suggestion: parsed.isActionable ? null : (parsed.suggestion ?? null),
    };
  }
}
