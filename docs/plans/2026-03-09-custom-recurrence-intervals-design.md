# Custom Recurrence Intervals — Design

## Cíl

Uživatel může nastavit vlastní interval opakování (např. "každé 4 měsíce", "každé 2 týdny v Po a Pá").

## Rozšířený formát stringu

Zpětně kompatibilní — stávající formáty zůstávají beze změny, nové přidávají interval `N`:

| Současný | Nový (interval > 1) | Význam |
|---|---|---|
| `DAILY` | `DAILY:3` | každé 3 dny |
| `WEEKLY:0,3,5` | `WEEKLY:2:0,3,5` | každé 2 týdny v Ne, St, Pá |
| `MONTHLY` | `MONTHLY:4` | každé 4 měsíce |
| `MONTHLY_LAST` | `MONTHLY_LAST:2` | každé 2 měsíce, poslední den |
| `YEARLY` | `YEARLY:2` | každé 2 roky |

Pravidla parsování:
- `DAILY` = interval 1, `DAILY:N` = interval N
- `WEEKLY:days` = interval 1 (zpětně kompatibilní), `WEEKLY:N:days` = interval N (2 dvojtečky)
- `MONTHLY` / `MONTHLY_LAST` / `YEARLY` = interval 1, `TYPE:N` = interval N

Žádná změna DB schématu — stále plain text string v `tasks.recurrence`.

## Domain vrstva

Rozšíření `src/domain/services/recurrence.ts`:

**Typy** — přidání `interval: number` ke každému recurrence typu:
```typescript
interface RecurrenceDaily { type: "DAILY"; interval: number; }
interface RecurrenceWeekly { type: "WEEKLY"; interval: number; days: number[]; }
interface RecurrenceMonthly { type: "MONTHLY"; interval: number; }
interface RecurrenceMonthlyLast { type: "MONTHLY_LAST"; interval: number; }
interface RecurrenceYearly { type: "YEARLY"; interval: number; }
```

**Parser** — zpětně kompatibilní rozpoznání nových formátů.

**`computeNextDueDate`** — použije `interval` místo hardcoded 1:
- DAILY: `addDays(date, interval)`
- WEEKLY interval > 1: po vyčerpání dnů v aktuálním týdnu přeskočí `(interval - 1) * 7` dní navíc
- MONTHLY: `addMonths(date, interval)`
- MONTHLY_LAST: `lastDayOfMonth(addMonths(date, interval))`
- YEARLY: `addYears(date, interval)`

**`computeFirstOccurrence`** — beze změny (první výskyt je vždy od dneška).

## UI

Rozšíření `src/components/tasks/detail/task-recurrence.tsx`:

Stávající popover zůstává jako rychlá volba (presets). Přidá se volba "Vlastní..." pod presety.

Po kliknutí na "Vlastní..." se popover přepne na custom editor:
- Zpět tlačítko (vrátí na presety)
- Number input pro počet (min 1)
- Select pro typ (dnů / týdnů / měsíců / roků)
- Day picker (při výběru "týdnů") — stejný jako stávající
- Hotovo tlačítko (zavře popover)

**`formatRecurrence`** v `task-detail-panel.tsx` — rozšíření pro interval > 1:
- `DAILY:3` → "Každé 3 dny"
- `WEEKLY:2:1,5` → "Každé 2 týdny: Po, Pá"
- `MONTHLY:4` → "Každé 4 měsíce"

## i18n

Nové klíče v `cs.ts` a `en.ts`:
- `custom`, `back`, `done`, `every`
- `unitDays/Weeks/Months/Years` — pole pro pluralizaci
- `everyNDays/Weeks/Months/Years` — formátovací stringy s `{n}` placeholderem

Česká pluralizace (1 / 2–4 / 5+) řešena helper funkcí.

## Dotčené soubory

1. `src/domain/services/recurrence.ts` — typy, parser, computeNextDueDate
2. `src/domain/services/__tests__/recurrence.test.ts` — testy pro intervaly
3. `src/components/tasks/detail/task-recurrence.tsx` — custom editor v popoveru
4. `src/components/tasks/task-detail-panel.tsx` — formatRecurrence
5. `src/lib/i18n/dictionaries/cs.ts` + `en.ts` — nové klíče

Žádná změna DB schématu, GraphQL schématu ani serveru.
