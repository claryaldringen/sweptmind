import type { ILlmProvider, LlmResponse, DecomposeResponse } from "@/domain/ports/llm-provider";
import { GTD_SYSTEM_PROMPT, GTD_DECOMPOSE_PROMPT } from "./system-prompt";

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

  async decomposeTask(title: string, context: { lists: string[]; tags: string[] }): Promise<DecomposeResponse> {
    const userMessage = `Task: "${title}"\nUser's lists: ${context.lists.join(", ") || "(none)"}\nUser's tags: ${context.tags.join(", ") || "(none)"}`;

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: GTD_DECOMPOSE_PROMPT },
          { role: "user", content: userMessage },
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
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s: { title?: string; listName?: string | null }) => ({
            title: String(s.title ?? ""),
            listName: s.listName ?? null,
          }))
        : [],
    };
  }
}
