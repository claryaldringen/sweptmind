import type { ILlmProvider, LlmResponse, DecomposeResponse } from "@/domain/ports/llm-provider";
import { getAnalyzePrompt, getDecomposePrompt } from "./system-prompt";

export class OpenAiCompatibleProvider implements ILlmProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;

  constructor(
    apiKey = process.env.LLM_API_KEY || "",
    baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model = process.env.LLM_MODEL || "gpt-4o-mini",
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
  }

  async analyzeTask(title: string, locale: string): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: getAnalyzePrompt(locale) },
          { role: "user", content: title },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM API error: ${res.status} ${body}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from LLM API");
    }

    const parsed = JSON.parse(content);
    return {
      isActionable: Boolean(parsed.isActionable),
      suggestion: parsed.isActionable ? null : (parsed.suggestion ?? null),
    };
  }

  async decomposeTask(title: string, context: { lists: string[]; tags: string[] }, locale: string): Promise<DecomposeResponse> {
    const userMessage = `Task: "${title}"\nUser's lists: ${context.lists.join(", ") || "(none)"}\nUser's tags: ${context.tags.join(", ") || "(none)"}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: getDecomposePrompt(locale) },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM API error: ${res.status} ${body}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from LLM API");
    }

    const parsed = JSON.parse(content);
    return {
      projectName: String(parsed.projectName ?? ""),
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s: { title?: string; listName?: string | null; dependsOn?: number | null }) => ({
            title: String(s.title ?? ""),
            listName: s.listName ?? null,
            dependsOn: typeof s.dependsOn === "number" ? s.dependsOn : null,
          }))
        : [],
    };
  }
}
