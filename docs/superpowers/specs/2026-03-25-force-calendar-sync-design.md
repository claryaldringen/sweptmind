# Force Calendar Sync — Per-Task Override

## Problém

Globální sync scope (v Settings) určuje, které tasky se synchronizují do kalendáře. Uživatel ale chce mít možnost u konkrétního tasku vynutit synchronizaci, i když nesplňuje globální pravidla (např. task má jen datum bez času a scope je "pouze s přesným časem").

## Řešení

Nový boolean flag `forceCalendarSync` na tasku. Pokud je `true`, task se synchronizuje do všech kalendářů bez ohledu na globální sync scope.

## Vrstvy

### DB schéma

- Nový sloupec `force_calendar_sync` (boolean, default `false`) v tabulce `tasks`
- Soubor: `src/server/db/schema/tasks.ts`

### Domain entity

- Nový field `forceCalendarSync: boolean` v `Task` interface
- Nový field `forceCalendarSync?: boolean` v `UpdateTaskInput` interface (domain DTO)
- Soubor: `src/domain/entities/task.ts`

### Validace

- Přidat `forceCalendarSync: z.boolean().nullish()` do `updateTaskSchema` v `src/lib/graphql-validators.ts`
- Bez tohoto by Zod field při parsování odstranil a update by tiše nic neudělal

### Domain services

**`google-calendar.service.ts`** — metoda `taskMatchesSyncScope()`:
- Přidat `if (task.forceCalendarSync) return true` jako první podmínku

**`calendar.service.ts`** — metoda `getSyncableTasks()`:
- Do filtru přidat `|| t.forceCalendarSync` pro zahrnutí force-syncnutých tasků
- CalDAV handler a iCal feed route volají `getSyncableTasks()`, takže nevyžadují další změny

**`task.service.ts`** — toggle-off cleanup:
- Při updatu tasku, pokud se `forceCalendarSync` mění z `true` na `false` a task nesplňuje globální sync scope, smazat odpovídající kalendářovou událost (volat `deleteTaskEvent`)

### GraphQL — server

- Přidat `forceCalendarSync` field na Task output type
- Přidat computed field `matchesSyncScope: Boolean` na Task output type — server-autoritativní výpočet, zda task spadá do globálního sync scope (zamezí duplikaci logiky na klientovi)
- Přidat `forceCalendarSync` do `UpdateTaskInput`
- Žádná nová mutace — využije se existující `updateTask`
- Soubor: `src/server/graphql/types/task.ts`

### GraphQL — klient

- Přidat `forceCalendarSync` a `matchesSyncScope` do response selection setu v:
  - `src/graphql/mutations/tasks.graphql` (UpdateTask mutace)
  - `src/components/tasks/task-detail-panel.tsx` (inline `UPDATE_TASK` GQL string)
  - Příslušné query fragmenty, pokud existují

### UI — tlačítko v detail panelu

- Umístění: komponenta `src/components/tasks/detail/task-dates.tsx`
- Ikona: `CalendarPlus` (neaktivní) / `CalendarCheck` (aktivní) z Lucide
- Viditelnost: pouze pokud:
  1. Task má `dueDate`
  2. `matchesSyncScope` je `false` (server-autoritativní field)
- Klik: přepne `forceCalendarSync` přes `updateTask` mutaci s optimistickým updatem
- Pokud task už splňuje globální scope, tlačítko se nezobrazí (synchronizace probíhá automaticky)
- Když je `syncAll` zapnuté, všechny tasky s dueDate spadají do scope → tlačítko se nikdy nezobrazí (korektní chování)

## Budoucí rozšíření

- Opačný override (`forceCalendarExclude`) pro vyloučení tasku ze syncu
