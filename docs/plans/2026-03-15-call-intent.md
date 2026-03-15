# Call Intent Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect phone call intent in tasks, extract person's name, and show matching contacts from phone's address book on native platforms.

**Architecture:** Extends AI analysis pipeline with orthogonal `callIntent` field. AI detects call intent from task title + device context + list name. Frontend searches native contacts via new `ContactsPort` in native-bridge.

**Tech Stack:** Pothos GraphQL, Drizzle ORM, Capacitor `@capacitor-community/contacts`, native-bridge port/adapter pattern

---

### Task 1: Add `callIntent` to LLM interface and providers

**Files:**
- Modify: `src/domain/ports/llm-provider.ts`
- Modify: `src/infrastructure/llm/system-prompt.ts`
- Modify: `src/infrastructure/llm/openai-compatible-provider.ts`
- Modify: `src/infrastructure/llm/ollama-provider.ts`

**Changes:**

1. Add to `LlmResponse`:
```typescript
callIntent: { name: string; reason: string | null } | null;
```

2. Add to LLM context interface:
```typescript
context: { lists: string[]; tasks: { id: string; title: string }[]; deviceContext: string | null; listName: string | null }
```

3. Update system prompts (cs + en) — add 5th outcome:
```json
{"isActionable": true, "callIntent": {"name": "Tomáš", "reason": "kvůli stránkám"}}
```
- Call intent is orthogonal — can coexist with `isActionable: true`
- Higher probability when device context is "phone" or list is phone-related
- Detect verbs: zavolat, telefonovat, call, phone

4. Update `formatUserMessage` in both providers to include device context and list name

5. Update `parseResponse` in both providers to extract `callIntent`

### Task 2: Add `callIntent` to DB, entity, repository, and GraphQL

**Files:**
- Modify: `src/server/db/schema/ai-analyses.ts`
- Modify: `src/domain/entities/task-ai-analysis.ts`
- Modify: `src/infrastructure/persistence/drizzle-task-ai-analysis.repository.ts`
- Modify: `src/server/graphql/types/ai-analysis.ts`
- Modify: `src/domain/services/ai.service.ts`

**Changes:**

1. DB: add `callIntent: jsonb("call_intent")` column
2. Entity: add `callIntent: { name: string; reason: string | null } | null` to both interfaces
3. Repository: update `toEntity()` to cast JSONB, update `upsert` set clause
4. GraphQL: add `CallIntentRef` object type + expose field on `TaskAiAnalysisType`
5. AI service: pass `deviceContext` and list name to LLM context, persist `callIntent`

### Task 3: Update frontend queries and types

**Files:**
- Modify: `src/hooks/use-task-analysis.ts`
- Modify: `src/components/providers/app-data-provider.tsx`
- Modify: `src/components/tasks/task-detail-panel.tsx`

**Changes:**

1. Add `callIntent { name reason }` to all GraphQL fragments/queries
2. Update `AnalyzeTaskResult`, `AppTask`, `TaskDetail` TypeScript interfaces
3. Pass `callIntent` to `TaskAiSection`

### Task 4: Add ContactsPort to native-bridge

**Files:**
- Create: `packages/native-bridge/src/ports/contacts.port.ts`
- Create: `packages/native-bridge/src/adapters/web/web-contacts.adapter.ts`
- Create: `packages/native-bridge/src/adapters/capacitor/capacitor-contacts.adapter.ts`
- Modify: `packages/native-bridge/src/types.ts`
- Modify: `packages/native-bridge/src/factory.ts`
- Modify: `packages/native-bridge/src/index.ts`

**Changes:**

1. Types: add `Contact = { name: string; phones: string[] }`
2. Port: `ContactsPort` with `isSupported(): boolean` and `searchByName(name: string): Promise<Contact[]>`
3. Web adapter: `isSupported()` → false, `searchByName()` → `[]`
4. Capacitor adapter: uses `@capacitor-community/contacts` to search
5. Factory: add `getContactsAdapter()` singleton
6. Export all from index

### Task 5: Update TaskAiSection UI for call intent

**Files:**
- Modify: `src/components/tasks/detail/task-ai-section.tsx`

**Changes:**

1. Accept new prop `callIntent: { name: string; reason: string | null } | null`
2. When `callIntent` is present, render call section:
   - Phone icon + name + reason
   - On native (Capacitor): search contacts, show matches with tel: call buttons
   - On web: show just the name/reason text
3. Call section is shown alongside other outcomes (not mutually exclusive)

### Task 6: Update tests

**Files:**
- Modify: `src/domain/services/__tests__/ai.service.test.ts`

**Changes:**

1. Add `callIntent: null` to `makeAnalysis` defaults
2. Add `callIntent: null` to LLM mock default return
3. Add `callIntent: null` to all `upsert` assertions
4. Update `analyzeTask` mock call context to include `deviceContext: null, listName: null`
5. Run `yarn db:push`, `yarn test --run`, `yarn typecheck`
