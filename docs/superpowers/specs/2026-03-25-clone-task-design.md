# Clone Task — Duplikace úkolu bez datumu

## Problém

Některé úkoly se opakují nepravidelně. Uživatel chce mít možnost rychle naklonovat existující úkol (včetně kroků), ale bez datumových polí — datum si nastaví sám podle potřeby.

## Řešení

Nová GraphQL mutace `cloneTask(id)` s optimistickým UI updatem pro okamžité zobrazení.

## Vrstvy

### Domain service

- Nová metoda `clone(id: string, userId: string): Promise<Task>` v `task.service.ts`
- Načte zdrojový task přes `taskRepo.findById(id, userId)` — pokud neexistuje nebo patří jinému uživateli, throw `"Task not found"`
- Načte steps zdrojového tasku. Pokud `stepRepo` není nakonfigurován, throw `"StepRepository not configured"` (vzor z `convertToList`)
- Vytvoří nový task **přímo přes `taskRepo.create`** (ne přes `this.create()`, aby se nepočítal reminderAt a netriggeroval Google Calendar sync):
  - **Kopíruje:** title, notes, listId, locationId, locationRadius, deviceContext
  - **Nekopíruje:** dueDate, dueDateEnd, reminderAt, recurrence, isCompleted, completedAt, forceCalendarSync, blockedByTaskId, shareCompletionMode, shareCompletionAction, shareCompletionListId, attachments
- sortOrder = nejnižší sortOrder v daném listu - 1 (existující vzor)
- Zkopíruje steps: title + sortOrder, isCompleted=false. Pokud zdrojový task nemá steps, klon taky nemá.
- **Tagy nekopíruje** — `TaskService` nemá přístup k `ITagRepository`. Kopírování tagů řeší resolver (viz GraphQL sekce).

### GraphQL — server

- Nová mutace `cloneTask(id: String!): Task!` v `src/server/graphql/types/task.ts`
- Resolver:
  1. Zavolá `ctx.services.task.clone(args.id, ctx.userId!)` → získá nový task
  2. Zkopíruje tagy: `ctx.services.tag.getByTask(args.id)` → pro každý tag `ctx.services.tag.addToTask(newTask.id, tag.id)`
  3. Vrátí nový task se steps

### GraphQL — klient

- Inline GQL mutace v `task-detail-panel.tsx` (stejný pattern jako `UPDATE_TASK`):
  ```graphql
  mutation CloneTask($id: String!) {
    cloneTask(id: $id) {
      ...TaskFields
    }
  }
  ```
- Také přidat do `src/graphql/mutations/tasks.graphql` pro codegen

### UI — tlačítko v detail panelu

- Umístění: v `task-detail-panel.tsx`, vedle jiných akcí (ne v `task-actions.tsx` footer baru)
- Ikona: `Copy` z Lucide
- Text: "Klonovat úkol" / "Clone task"
- Po kliknutí:
  1. Zavolá `cloneTask` mutaci
  2. V `update` callbacku přidá nový task do Apollo cache pro daný list (writeQuery)
  3. Otevře detail nového tasku (`?task=<newId>`)

### i18n

- cs: `cloneTask: "Klonovat úkol"`
- en: `cloneTask: "Clone task"`
