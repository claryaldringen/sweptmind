# Date Range pro dueDate — Design

## Cíl

Umožnit nastavení koncového data (`dueDateEnd`) pro task, aby šlo vyjádřit vícedenní/vícehodinové události (víkendové akce, konference, apod.).

## Datový model

Nový sloupec `due_date_end` (`text`, nullable) v tabulce `tasks`. Formát shodný s `dueDate` — `YYYY-MM-DD` nebo `YYYY-MM-DDTHH:mm`. Pokud je `null`, task se chová jako dosud.

## Viditelnost

Beze změny. `reminderAt` řídí viditelnost a počítá se z `dueDate` (začátku). Koncové datum viditelnost neovlivňuje.

## Planned pohled

Task se zobrazí u prvního dne rozsahu (podle `dueDate`). Formátování: "21.–23. bře" nebo "21. bře 14:00 – 23. bře 18:00".

## UI (task-detail-panel)

Po nastavení `dueDate` se pod ním zobrazí odkaz "Přidat koncové datum". Po kliknutí:

1. **Quick buttons** (chipsy v řádku):
   - **"+1h"** — konec = začátek + 1 hodina. Pokud začátek nemá čas, přidá `T00:00` + 1h.
   - **"Do neděle"** — konec = nejbližší neděle od začátku. Zobrazí se jen pokud začátek není neděle.
   - **"Vlastní"** — otevře date picker pro ruční výběr koncového data s volitelným časem.

2. Po nastavení se zobrazí zvolený rozsah s možností editace (klik → date picker) nebo smazání (křížek).

## Recurrence

Při dokončení opakujícího se tasku se vypočítá trvání (`dueDateEnd - dueDate`) a přičte k novému `dueDate`. Rozsah se posune celý se zachováním délky.

## CalDAV

`DTSTART` = `dueDate`, `DTEND` = `dueDateEnd` (pokud existuje). Při importu se `DTEND` mapuje na `dueDateEnd`. Stávající logika (1 hodina / 1 den fallback pro tasks bez `dueDateEnd`) zůstává.

## GraphQL

Nové pole `dueDateEnd: String` (nullable) na typu `Task`. Nový input `dueDateEnd` na `CreateTaskInput`, `UpdateTaskInput`, `BulkTaskUpdateInput`, `ImportTaskInput`.

## Validace

- `dueDateEnd` nesmí být před `dueDate` (Zod validace).
- `dueDateEnd` bez `dueDate` je neplatné.
- Pokud se smaže `dueDate`, smaže se i `dueDateEnd`.

## Co se nemění

- Viditelnostní logika (`task-visibility.ts`) — řídí se `dueDate` a `reminderAt`.
- `reminderAt` chování — auto-compute z `dueDate` (začátku).
- Push notifikace — spouští se podle `dueDate` s časem.
