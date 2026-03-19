# AI GTD Analýza — Design

## Cíl

Premium uživatelům automaticky analyzovat viditelné tasky pomocí LLM a označit ty, které nejsou konkrétní "next action" podle GTD. Po kliknutí na žárovku ukázat AI návrh jak task přeformulovat (popover — bude řešen v pozdější fázi).

## Architektura

**API vrstva:** GraphQL mutace `analyzeTask(taskId)` která:
1. Načte task title
2. Zavolá LLM přes abstrakci (Ollama pro dev, cloudový LLM pro prod)
3. Uloží výsledek do DB
4. Vrátí `{ isActionable, suggestion }`

**LLM prompt:** Jednoduchý prompt — "Is this a concrete, single next action per GTD? If not, suggest how to reformulate it."

## DB schéma

Nová tabulka `task_ai_analysis`:

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | text (PK) | UUID |
| taskId | text (FK → tasks, unique) | |
| isActionable | boolean | Je to next action? |
| suggestion | text? | Návrh přeformulování |
| analyzedTitle | text | Title v době analýzy |
| createdAt | timestamp | |

Invalidace: při změně task title se smaže záznam → při dalším načtení se znovu analyzuje.

## Flow

1. Klient načte viditelné tasky (existující `visibleTasks` query)
2. Tasky mají nové pole `aiAnalysis { isActionable, suggestion }`
3. Klient najde tasky bez analýzy (nebo s invalidovanou — `analyzedTitle !== title`)
4. Klient volá mutaci `analyzeTask(taskId)` postupně po jednom (throttled)
5. Server zavolá LLM, uloží výsledek, vrátí ho
6. Žárovka se objeví u tasků kde `isActionable = false`

## UI (Fáze 1)

- **Žárovka** (`Lightbulb` z lucide-react) v metadata řádku task-item, žlutá barva
- Jen pro premium uživatele
- Během analýzy: žárovka s `animate-pulse` (loading state)
- Klik: zatím nic (popover bude ve Fázi 2)

## LLM abstrakce

```
src/domain/ports/llm-provider.ts          — ILlmProvider interface
src/infrastructure/llm/ollama-provider.ts — Ollama implementace (dev)
src/infrastructure/llm/cloud-provider.ts  — Cloudový LLM (prod, později)
src/domain/services/ai.service.ts         — AiService (analyzeTask)
```

## Env proměnné

- `OLLAMA_BASE_URL` — default `http://localhost:11434`
- `OLLAMA_MODEL` — default `gemma3:4b`

## Premium gating

- AI analýza se spouští jen pro premium uživatele (kontrola v GraphQL resolveru)
- Free uživatelé pole `aiAnalysis` dostávají jako `null`
