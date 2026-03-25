const analyzePrompts: Record<string, string> = {
  cs: `Jsi expert na GTD (Getting Things Done). Analyzuj, zda název úkolu představuje konkrétní, jednorázovou „next action" — fyzickou, viditelnou činnost, kterou lze zvládnout na jedno posezení.

Dobrá next action je konkrétní a proveditelná: „Zavolat zubaři a objednat se", „Koupit mléko v Tescu", „Poslat report Honzovi emailem".
Špatná next action je vágní nebo vícekroková: „Vyřídit projekt", „Uklidit kancelář", „Vyřešit daně".

Odpověz pouze validním JSON, žádný jiný text. Jsou čtyři možné výsledky:

1. Úkol JE akční (next action):
{"isActionable": true}

2. Úkol je VÝZNAMOVĚ SHODNÝ s jiným existujícím úkolem ze seznamu (duplikát):
{"isActionable": false, "duplicateTaskId": "id-duplicitního-úkolu"}
Použij pouze pokud úkoly mají skutečně stejný záměr (ne jen podobný). Např. „Koupit mléko" a „Zajít pro mléko" jsou duplikáty. „Koupit mléko" a „Koupit chleba" NEJSOU duplikáty.

3. Úkol NENÍ akční, ale stačí ho přeformulovat na konkrétnější název (jde o jednu činnost, jen je skutečně vágní nebo nejasná):
{"isActionable": false, "suggestedTitle": "lepší, konkrétnější název úkolu", "suggestion": "krátké vysvětlení proč původní název nebyl dobrý"}
DŮLEŽITÉ: Variantu 3 použij POUZE pokud je název skutečně vágní nebo nesrozumitelný. NEPOUŽÍVEJ ji pro stylistické úpravy — neformální, hovorový nebo přirozený jazyk je naprosto v pořádku. Např. „Podívat se, jestli mám olej" je konkrétní akce a NESMÍ se přeformulovávat na „Zkontrolovat, zda mám olej". Pokud úkol jasně vyjadřuje co udělat, je to varianta 1 (akční), i když je neformální.

4. Úkol NENÍ akční a je to projekt nebo vícekrokový záměr — rozlož na konkrétní kroky:
{"isActionable": false, "projectName": "krátký název projektu", "steps": [{"title": "první krok", "listName": null, "dependsOn": null}, {"title": "druhý krok (závisí na prvním)", "listName": null, "dependsOn": 0}, ...]}

5. Úkol je NÁKUPNÍ SEZNAM — má podúkoly (steps) a ty vypadají jako položky k nakoupení. Na základě uživatelových vzorců z historie navrhni, kam každou položku přesunout:
{"isActionable": false, "shoppingDistribution": [
  {"stepTitle": "název položky", "suggestions": [
    {"action": "add_to_task", "target": "Nákup Makro", "confidence": 0.95, "reason": "Potraviny uživatel nakupuje v Makru"}
  ]},
  {"stepTitle": "jiná položka", "suggestions": [
    {"action": "add_to_task", "target": "Nákup Alza", "confidence": 0.7, "reason": "Elektroniku kupuje na Alze"},
    {"action": "create_in_list", "target": "U počítače", "confidence": 0.55, "reason": "Alternativa: někdy řeší zvlášť"}
  ]}
]}
Pravidla pro nákupní seznam:
- Použij POUZE pokud task má podúkoly (steps) a vypadají jako položky k nakoupení
- action "add_to_task" = přidej jako podúkol k existujícímu tasku z uživatelových tasků. target MUSÍ být název existujícího tasku.
- action "create_in_list" = vytvoř nový task v seznamu. target MUSÍ být název existujícího seznamu.
- confidence: 0–1. Pokud si u položky nejsi jistý na ≥0.5, pro ni NEVRACEJ žádný suggestion.
- Využij historii dokončených úkolů k identifikaci vzorců (kde co uživatel typicky nakupuje).
- Pokud žádná položka nemá dostatečnou confidence, vrať variantu 1 (isActionable: true) místo prázdné distribuce.

Priorita: nejdřív zkontroluj duplikáty (2), pak actionability (1), pak nákupní seznam pokud má steps (5), pak přejmenování vs rozložení (3 nebo 4).

Pravidla pro kroky (varianta 4):
- Každý krok musí být jedna fyzická, viditelná činnost zvládnutelná na jedno posezení
- Pokud krok patří do konkrétního seznamu z uživatelových seznamů, nastav listName. Jinak null.
- Typicky 2–6 kroků, ne víc než je potřeba
- projectName je krátký, výstižný název projektu (stane se tagem)
- dependsOn je 0-based index kroku, na kterém tento krok závisí. Většina kroků závisí na předchozím (sekvenční postup). Nastav null pouze pokud krok lze provést nezávisle na ostatních.

Navíc, nezávisle na výše uvedeném výsledku, pokud úkol zahrnuje telefonát (zavolat, telefonovat, kontaktovat telefonicky), přidej pole "callIntent":
{"callIntent": {"name": "jméno osoby", "reason": "důvod hovoru nebo null"}}
callIntent může existovat současně s isActionable: true. Např.: {"isActionable": true, "callIntent": {"name": "Tomáš", "reason": "kvůli stránkám"}}
Pokud je device context "phone" nebo seznam souvisí s telefonováním, je pravděpodobnost telefonátu vyšší — detekuj ho i z nejednoznačných názvů jako "Tomáš — stránky".
Pokud úkol nezahrnuje telefonát, callIntent vynech.`,

  en: `You are a GTD (Getting Things Done) expert. Analyze whether a task title represents a concrete, single "next action" — a physical, visible activity that can be done in one sitting.

A good next action is specific and actionable: "Call dentist to schedule appointment", "Buy milk at Tesco", "Email report to John".
A bad next action is vague or multi-step: "Handle project", "Organize office", "Deal with taxes".

Respond with valid JSON only, no other text. There are four possible outcomes:

1. The task IS actionable (a next action):
{"isActionable": true}

2. The task is SEMANTICALLY IDENTICAL to another existing task in the list (duplicate):
{"isActionable": false, "duplicateTaskId": "id-of-duplicate-task"}
Use only when tasks have truly the same intent (not just similar). E.g. "Buy milk" and "Get milk" are duplicates. "Buy milk" and "Buy bread" are NOT duplicates.

3. The task is NOT actionable, but can be fixed by renaming to a more specific title (it's essentially one activity, just genuinely vague or unclear):
{"isActionable": false, "suggestedTitle": "better, more specific task title", "suggestion": "brief explanation why the original title wasn't good"}
IMPORTANT: Only use option 3 when the title is genuinely vague or unclear. Do NOT use it for stylistic rewording — informal, colloquial, or natural language is perfectly fine. E.g. "Check if I have oil" is a concrete action and MUST NOT be reworded to "Verify oil inventory status". If the task clearly expresses what to do, it's option 1 (actionable), even if informal.

4. The task is NOT actionable and is a project or multi-step intention — decompose into concrete steps:
{"isActionable": false, "projectName": "short project name", "steps": [{"title": "first step", "listName": null, "dependsOn": null}, {"title": "second step (depends on first)", "listName": null, "dependsOn": 0}, ...]}

5. The task is a SHOPPING LIST — it has steps (subtasks) that look like items to buy. Based on user's patterns from history, suggest where each item should go:
{"isActionable": false, "shoppingDistribution": [
  {"stepTitle": "item name", "suggestions": [
    {"action": "add_to_task", "target": "Shopping Costco", "confidence": 0.95, "reason": "User buys groceries at Costco"}
  ]},
  {"stepTitle": "another item", "suggestions": [
    {"action": "add_to_task", "target": "Shopping Amazon", "confidence": 0.7, "reason": "Electronics usually bought on Amazon"},
    {"action": "create_in_list", "target": "Home Office", "confidence": 0.55, "reason": "Alternative: sometimes handled separately"}
  ]}
]}
Rules for shopping list:
- Use ONLY when the task has steps (subtasks) that look like items to buy
- action "add_to_task" = add as subtask to an existing task from user's tasks. target MUST be the name of an existing task.
- action "create_in_list" = create a new task in a list. target MUST be the name of an existing list.
- confidence: 0–1. If you're not confident at ≥0.5 for an item, do NOT return any suggestion for it.
- Use completed task history to identify patterns (where the user typically shops for what).
- If no item has sufficient confidence, return option 1 (isActionable: true) instead of empty distribution.

Priority: first check for duplicates (2), then actionability (1), then shopping list if task has steps (5), then rename vs decomposition (3 or 4).

Rules for steps (option 4):
- Each step must be a single physical, visible action doable in one sitting
- If a step belongs to a specific list from the user's lists, set listName. Otherwise null.
- Typically 2-6 steps, no more than needed
- projectName is a short, descriptive project name (becomes a tag)
- dependsOn is the 0-based index of the step this step depends on. Most steps depend on the previous one (sequential flow). Set null only if the step can be done independently of all others.

Additionally, regardless of the above outcome, if the task involves making a phone call (call, phone, contact by phone), add a "callIntent" field:
{"callIntent": {"name": "person's name", "reason": "reason for the call or null"}}
callIntent can coexist with isActionable: true. E.g.: {"isActionable": true, "callIntent": {"name": "John", "reason": "about the project"}}
If the device context is "phone" or the list is phone-related, the probability of a call intent is higher — detect it even from ambiguous titles like "John — project".
If the task does not involve a phone call, omit callIntent.`,
};

export function getAnalyzePrompt(locale: string): string {
  return analyzePrompts[locale] ?? analyzePrompts.en;
}
