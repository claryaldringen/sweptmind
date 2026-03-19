# Call Intent Detection — Design

## Goal

When a task involves making a phone call, AI detects the intent and extracts the person's name. On native platforms (iOS/Android), the app searches the device's contacts and shows matching results with "Call" buttons.

## Architecture

The feature extends the existing AI analysis pipeline with a new orthogonal field `callIntent`. Unlike other AI outcomes (rename, decompose, duplicate), call intent can coexist with `isActionable: true` — a task like "Call Tomáš about the website" is actionable AND has a call intent.

Context signals for higher call probability:
- Task's `deviceContext === "phone"`
- Task belongs to a phone-related list (e.g., "Telefonáty", "Phone Calls")
- Explicit call verbs in the title ("zavolat", "call", "telefonovat", "phone")

## Data Flow

1. **AI analysis** — LLM receives task title + device context + list name → returns `callIntent: { name, reason }` or `null`
2. **Storage** — `call_intent` JSONB column in `task_ai_analyses`
3. **Frontend** — when `callIntent` is present:
   - On Capacitor (iOS/Android): search contacts via `ContactsPort.searchByName(name)` → display matches with tel: links
   - On Web/Desktop: show the detected name + reason, but no contact search

## LLM Response Extension

```json
{
  "isActionable": true,
  "callIntent": { "name": "Tomáš", "reason": "kvůli stránkám" }
}
```

`callIntent` is independent of `isActionable`, `suggestedTitle`, `decomposition`, `duplicateTaskId`. A task can be actionable AND have a call intent simultaneously.

## LLM Context Extension

The user message sent to LLM will include:
- `Device context: phone` (if task has phone device context)
- `List: Telefonáty` (the list the task belongs to)

This helps LLM detect call intent even in ambiguous titles like "Tomáš — stránky" when context is phone-related.

## Native Bridge

New `ContactsPort` interface following existing port/adapter pattern:
- `isSupported(): boolean`
- `searchByName(name: string): Promise<Contact[]>`
- `Contact = { name: string; phones: string[] }`

Adapters:
- `CapacitorContactsAdapter` — uses `@capacitor-community/contacts`
- `WebContactsAdapter` — `isSupported()` returns false, `searchByName()` returns `[]`

## UI (TaskAiSection)

New render path when `callIntent` is present (shown alongside other AI outcomes):
- Phone icon + detected name + reason
- On native: list of matching contacts with phone numbers and "Call" buttons (tel: links)
- On web: just the name/reason text, no contacts
- Dismiss button to hide

## Scope

- Free feature (no premium gating for the contact display — only AI analysis requires premium)
- No contact sync/storage — contacts are searched locally at render time
- No contact creation — read-only access
