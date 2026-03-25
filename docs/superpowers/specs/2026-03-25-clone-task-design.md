# Clone Task — Duplikace úkolu bez datumu

## Problém

Některé úkoly se opakují nepravidelně. Uživatel chce mít možnost rychle naklonovat existující úkol (včetně kroků), ale bez datumových polí — datum si nastaví sám podle potřeby.

## Řešení

Nová GraphQL mutace `cloneTask(id)` s optimistickým UI updatem pro okamžité zobrazení.

## Vrstvy

### Domain service

- Nová metoda `clone(id: string, userId: string): Promise<Task>` v `task.service.ts`
- Načte zdrojový task + jeho steps
- Vytvoří nový task s kopírovanými poli:
  - **Kopíruje:** title, notes, listId, locationId, locationRadius, deviceContext
  - **Nekopíruje:** dueDate, dueDateEnd, reminderAt, recurrence, isCompleted, completedAt, forceCalendarSync, blockedByTaskId, shareCompletionMode, shareCompletionAction, shareCompletionListId
- sortOrder = nejnižší sortOrder v daném listu - 1 (stejný vzor jako `create`)
- Zkopíruje steps: title + sortOrder, isCompleted=false
- Zkopíruje tagy zdrojového tasku na nový task

### GraphQL — server

- Nová mutace `cloneTask(id: String!): Task!` v `src/server/graphql/types/task.ts`
- Resolver zavolá `ctx.services.task.clone(args.id, ctx.userId!)`
- Vrací nový task se steps (pro Apollo cache)

### GraphQL — klient

- Nová mutace v `src/graphql/mutations/tasks.graphql`:
  ```graphql
  mutation CloneTask($id: String!) {
    cloneTask(id: $id) {
      ...TaskFields
    }
  }
  ```

### UI — tlačítko v detail panelu

- Umístění: v sekci akcí v `task-detail-panel.tsx`
- Ikona: `Copy` z Lucide
- Text: "Klonovat úkol" / "Clone task"
- Po kliknutí:
  1. Optimistický update — přidá nový task do Apollo cache pro daný list (writeQuery)
  2. Zavolá `cloneTask` mutaci
  3. Po odpovědi přepíše optimistická data reálnými
  4. Otevře detail nového tasku (`?task=<newId>`)

### i18n

- cs: `cloneTask: "Klonovat úkol"`
- en: `cloneTask: "Clone task"`
