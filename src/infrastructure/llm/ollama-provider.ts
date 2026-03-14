import type { ILlmProvider, LlmResponse } from "@/domain/ports/llm-provider";

const SYSTEM_PROMPT = `You are a GTD (Getting Things Done) expert. Analyze whether a task title represents a concrete, single "next action" — a physical, visible activity that can be done in one sitting.

A good next action is specific and actionable: "Call dentist to schedule appointment", "Buy milk at Tesco", "Email report to John".
A bad next action is vague or multi-step: "Handle project", "Organize office", "Deal with taxes".

Respond with valid JSON only, no other text:
{"isActionable": true/false, "suggestion": "suggested reformulation or null"}

If isActionable is true, set suggestion to null.
If isActionable is false, suggest a concrete next action that would be a good first step.`;

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
          { role: "system", content: SYSTEM_PROMPT },
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
