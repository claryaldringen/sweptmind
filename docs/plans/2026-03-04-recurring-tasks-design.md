# Cyklické tasky — Design

## Cíl

Umožnit úkolům opakovat se v pravidelných intervalech. Po dokončení se úkol automaticky "resetuje" s posunutým dueDate na další výskyt.

## Model

**Jednoduchý reset:** Po dokončení opakujícího se úkolu se `isCompleted` vrátí na false a `dueDate` se posune na další výskyt. Žádná historie, žádné kopie, žádné instance.

## Datový formát

Existující pole `recurrence: string | null` (iCal RRULE komentář v DB). Vlastní jednoduchý formát:

| Hodnota | Význam |
|---------|--------|
| `null` | Neopakuje se |
| `DAILY` | Každý den |
| `WEEKLY:1,3,5` | Každý týden v dané dny (0=Ne, 1=Po, ..., 6=So) |
| `MONTHLY` | Každý měsíc (stejný den v měsíci) |
| `YEARLY` | Každý rok (stejné datum) |

Bez koncového data — opakuje se navždy, dokud uživatel ručně nezruší.

## Business logika

- `parseRecurrence(recurrence: string)` — parsuje string na typ + dny
- `computeNextDueDate(recurrence: string, currentDueDate: string): string` — další výskyt
- `toggleCompleted`: pokud `recurrence` !== null a úkol se dokončuje → reset + posun dueDate

## UI

Nová sekce v task-detail-panel pod Reminder:
- Tlačítko s ikonou `Repeat` (lucide)
- Popover s výběrem frekvence + pro Týdně výběr dnů (Po–Ne toggle buttony)
- Zobrazení aktuálního opakování na tlačítku

## Bez závislostí

Žádná RRULE knihovna — vlastní výpočet s `date-fns` pro jednoduché intervaly.
