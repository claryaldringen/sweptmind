import type {
  ILlmProvider,
  LlmResponse,
  LlmContext,
  LlmCallIntent,
} from "@/domain/ports/llm-provider";
import { getAnalyzePrompt } from "./system-prompt";

function formatUserMessage(title: string, context: LlmContext): string {
  const taskList =
    context.tasks.length > 0
      ? context.tasks.map((t) => `- [${t.id}] ${t.title}`).join("\n")
      : "(none)";
  let msg = `Task: "${title}"`;
  if (context.listName) msg += `\nList: ${context.listName}`;
  if (context.deviceContext) msg += `\nDevice context: ${context.deviceContext}`;
  msg += `\nUser's lists: ${context.lists.join(", ") || "(none)"}`;
  msg += `\nUser's existing tasks:\n${taskList}`;
  return msg;
}

function parseCallIntent(parsed: Record<string, unknown>): LlmCallIntent | null {
  if (parsed.callIntent && typeof parsed.callIntent === "object") {
    const ci = parsed.callIntent as Record<string, unknown>;
    if (typeof ci.name === "string" && ci.name) {
      return { name: ci.name, reason: (ci.reason as string) ?? null };
    }
  }
  return null;
}

function parseSteps(parsed: Record<string, unknown>): LlmResponse["steps"] {
  if (!Array.isArray(parsed.steps)) return null;
  const steps = parsed.steps
    .map((s: Record<string, unknown>) => ({
      title: String(s.title ?? s.step ?? s.name ?? "").trim(),
      listName: (s.listName as string | null) ?? null,
      dependsOn: typeof s.dependsOn === "number" ? s.dependsOn : null,
    }))
    .filter((s) => s.title.length > 0);
  return steps.length > 0 ? steps : null;
}

function parseResponse(parsed: Record<string, unknown>): LlmResponse {
  const callIntent = parseCallIntent(parsed);
  if (parsed.isActionable) {
    return {
      isActionable: true,
      suggestion: null,
      suggestedTitle: null,
      projectName: null,
      steps: null,
      duplicateTaskId: null,
      callIntent,
    };
  }
  return {
    isActionable: false,
    suggestion: (parsed.suggestion as string) ?? null,
    suggestedTitle: (parsed.suggestedTitle as string) ?? null,
    projectName: (parsed.projectName as string) ?? null,
    duplicateTaskId: (parsed.duplicateTaskId as string) ?? null,
    steps: parseSteps(parsed),
    callIntent,
  };
}

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

  async analyzeTask(title: string, locale: string, context: LlmContext): Promise<LlmResponse> {
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
          { role: "user", content: formatUserMessage(title, context) },
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

    return parseResponse(JSON.parse(content));
  }
}
