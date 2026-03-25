import type {
  ILlmProvider,
  LlmResponse,
  LlmContext,
  LlmCallIntent,
  LlmShoppingItem,
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
  if (context.steps.length > 0) {
    msg += `\nTask steps (items):\n${context.steps.map((s) => `- ${s}`).join("\n")}`;
  }
  if (context.completedTaskHistory.length > 0) {
    const history = context.completedTaskHistory
      .map(
        (t) =>
          `- "${t.title}" in list "${t.listName}"${t.hadSteps ? " (had steps)" : ""}, completed ${t.completedAt}`,
      )
      .join("\n");
    msg += `\nRecent completed tasks (patterns):\n${history}`;
  }
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

function parseShoppingDistribution(parsed: Record<string, unknown>): LlmShoppingItem[] | null {
  if (!Array.isArray(parsed.shoppingDistribution)) return null;
  const items = (parsed.shoppingDistribution as Record<string, unknown>[])
    .map((item) => ({
      stepTitle: String(item.stepTitle ?? "").trim(),
      suggestions: Array.isArray(item.suggestions)
        ? (item.suggestions as Record<string, unknown>[])
            .filter((s) => typeof s.confidence === "number" && (s.confidence as number) >= 0.5)
            .map((s) => ({
              action:
                s.action === "create_in_list"
                  ? ("create_in_list" as const)
                  : ("add_to_task" as const),
              target: String(s.target ?? "").trim(),
              confidence: s.confidence as number,
              reason: String(s.reason ?? "").trim(),
            }))
        : [],
    }))
    .filter((item) => item.stepTitle && item.suggestions.length > 0);
  return items.length > 0 ? items : null;
}

function parseResponse(parsed: Record<string, unknown>): LlmResponse {
  const callIntent = parseCallIntent(parsed);
  const shoppingDistribution = parseShoppingDistribution(parsed);
  if (shoppingDistribution) {
    return {
      isActionable: false,
      suggestion: null,
      suggestedTitle: null,
      projectName: null,
      steps: null,
      duplicateTaskId: null,
      callIntent,
      shoppingDistribution,
    };
  }
  if (parsed.isActionable) {
    return {
      isActionable: true,
      suggestion: null,
      suggestedTitle: null,
      projectName: null,
      steps: null,
      duplicateTaskId: null,
      callIntent,
      shoppingDistribution: null,
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
    shoppingDistribution: null,
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

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async analyzeTask(
    title: string,
    locale: string,
    context: LlmContext,
    model?: string,
  ): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? this.model,
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
