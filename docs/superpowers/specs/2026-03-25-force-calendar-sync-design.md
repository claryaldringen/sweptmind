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
- Soubor: `src/domain/entities/task.ts`

### Domain services

**`google-calendar.service.ts`** — metoda `taskMatchesSyncScope()`:
- Přidat `if (task.forceCalendarSync) return true` jako první podmínku

**`calendar.service.ts`** — metoda `getSyncableTasks()`:
- Do filtru přidat `|| t.forceCalendarSync` pro zahrnutí force-syncnutých tasků

### GraphQL

- Přidat `forceCalendarSync` field na Task output type
- Přidat `forceCalendarSync` do `UpdateTaskInput`
- Žádná nová mutace — využije se existující `updateTask`
- Soubor: `src/server/graphql/types/task.ts`

### UI — tlačítko v detail panelu

- Umístění: komponenta `task-dates.tsx` (nebo vedle date sekce)
- Ikona: `CalendarPlus` (neaktivní) / `CalendarCheck` (aktivní) z Lucide
- Viditelnost: pouze pokud:
  1. Task má `dueDate`
  2. Task **nesplňuje** globální sync scope (klientská replika logiky `taskMatchesSyncScope` na základě `calendarSyncAll` a `calendarSyncDateRange`)
- Klik: přepne `forceCalendarSync` přes `updateTask` mutaci s optimistickým updatem
- Pokud task už splňuje globální scope, tlačítko se nezobrazí (synchronizace probíhá automaticky)

## Budoucí rozšíření

- Opačný override (`forceCalendarExclude`) pro vyloučení tasku ze syncu
