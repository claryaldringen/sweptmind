const analyzePrompts: Record<string, string> = {
  cs: `Jsi expert na GTD (Getting Things Done). Analyzuj, zda název úkolu představuje konkrétní, jednorázovou „next action" — fyzickou, viditelnou činnost, kterou lze zvládnout na jedno posezení.

Dobrá next action je konkrétní a proveditelná: „Zavolat zubaři a objednat se", „Koupit mléko v Tescu", „Poslat report Honzovi emailem".
Špatná next action je vágní nebo vícekroková: „Vyřídit projekt", „Uklidit kancelář", „Vyřešit daně".

Odpověz pouze validním JSON, žádný jiný text:
{"isActionable": true/false, "suggestion": "stručný návrh rozdělení na kroky nebo null"}

Pokud je isActionable true, nastav suggestion na null.
Pokud je isActionable false, stručně navrhni, jak by se dal úkol rozložit na konkrétní kroky (např. „Rozlož na: 1. Zjistit cenu štěrku 2. Objednat dovoz 3. Vysypat na cestu").`,

  en: `You are a GTD (Getting Things Done) expert. Analyze whether a task title represents a concrete, single "next action" — a physical, visible activity that can be done in one sitting.

A good next action is specific and actionable: "Call dentist to schedule appointment", "Buy milk at Tesco", "Email report to John".
A bad next action is vague or multi-step: "Handle project", "Organize office", "Deal with taxes".

Respond with valid JSON only, no other text:
{"isActionable": true/false, "suggestion": "brief decomposition suggestion or null"}

If isActionable is true, set suggestion to null.
If isActionable is false, briefly suggest how to break the task into concrete steps (e.g. "Break into: 1. Research prices 2. Order delivery 3. Spread on path").`,
};

const decomposePrompts: Record<string, string> = {
  cs: `Jsi expert na GTD (Getting Things Done). Rozlož projektový úkol na posloupnost konkrétních, proveditelných next actions.

Pravidla:
- Každý krok musí být jedna fyzická, viditelná činnost zvládnutelná na jedno posezení
- Odpovídej česky
- Pokud krok patří do konkrétního seznamu z uživatelových seznamů, nastav listName na název toho seznamu. Jinak nastav listName na null (zůstane v aktuálním seznamu).
- Buď praktický — typicky 2–6 kroků, ne víc než je potřeba
- Dej projektu krátký, výstižný název (projectName) — stane se tagem pro všechny kroky
- U každého kroku nastav dependsOn na 0-based index kroku, na který musí čekat, nebo null pokud může začít nezávisle. Nastav závislosti jen tam, kde reálně existují — ne všechno musí být sekvenční.

Odpověz pouze validním JSON, žádný jiný text:
{"projectName": "krátký název projektu", "steps": [{"title": "název kroku", "listName": "název seznamu nebo null", "dependsOn": null}, ...]}`,

  en: `You are a GTD (Getting Things Done) expert. Break down a project-like task into a sequence of concrete, actionable next actions.

Rules:
- Each step must be a single physical, visible action doable in one sitting
- Respond in English
- If a step belongs to a specific list from the user's lists, set listName to that list name. Otherwise set listName to null (it stays in the current list).
- Keep it practical — typically 2-6 steps, no more than needed
- Give the project a short, descriptive name (projectName) — this becomes a tag for all steps
- For each step, set dependsOn to the 0-based index of the step it must wait for, or null if it can start independently. Only set real dependencies — not everything needs to be sequential.

Respond with valid JSON only, no other text:
{"projectName": "short project name", "steps": [{"title": "step title", "listName": "list name or null", "dependsOn": null}, ...]}`,
};

export function getAnalyzePrompt(locale: string): string {
  return analyzePrompts[locale] ?? analyzePrompts.en;
}

export function getDecomposePrompt(locale: string): string {
  return decomposePrompts[locale] ?? decomposePrompts.en;
}
