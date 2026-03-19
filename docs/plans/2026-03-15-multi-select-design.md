# Multi-Select Design

## Cíl

Umožnit uživatelům vybrat více položek (tasků, seznamů, subtasků) pomocí Shift/Cmd+click a šipek, provádět hromadné akce přes kontext menu a přetahovat vybrané položky. Funkce dostupná i ve free módu.

## Architektura

### Tři oddělené kontexty

Tři nezávislé React kontexty pro minimalizaci re-renderů:

- **TaskSelectionProvider** — výběr tasků v task listu
- **ListSelectionProvider** — výběr seznamů v sidebaru
- **StepSelectionProvider** — výběr subtasků v detail panelu

Každý provider spravuje `Set<string>` vybraných ID a expozuje `selectedIds`, `toggle`, `rangeTo`, `clear`, `selectAll`.

### Sdílený hook `useSelectionBehavior`

Generický hook zapouzdřující logiku výběru:

- **Prosté kliknutí:** Nahradí výběr jedinou položkou
- **Cmd/Ctrl + click:** Toggle jedné položky ve výběru
- **Shift + click:** Vybere rozsah od posledního kliknutí (anchor) po aktuální položku
- **Escape:** Zruší výběr
- **Cmd/Ctrl + A:** Vybere vše ve viditelném seznamu
- **Šipky:** Pohyb kurzoru/fokusu, Shift+šipka rozšiřuje výběr

### Detail panel

Při multi-selectu tasků (2+) se pravý panel zasune (zavře).

## Kontext menu a bulk akce

### Spouštění

Right-click na vybranou položku otevře kontext menu s hromadnými akcemi. Right-click na nevybranou položku — výběr se resetuje na tu jednu, otevře se kontext menu pro jednu položku.

### Akce podle typu

**Tasky** — všechny akce jako u jednotlivého tasku:
- Smazání (deleteTasks)
- Přesun do jiného seznamu (updateTasks — listId)
- Označení jako dokončené/nedokončené (toggleTasksCompleted)
- Nastavení dueDate (updateTasks — dueDate)
- Nastavení recurrence (updateTasks — recurrence)
- Přidání/odebrání tagů (updateTasks — tags)

**Seznamy** — jen hromadné smazání (deleteLists)

**Subtasky** — jen hromadné smazání (deleteSteps)

### GraphQL mutace

Nové bulk mutace:
- `deleteTasks(ids: [String!]!)`
- `updateTasks(ids: [String!]!, input: BulkTaskUpdateInput!)`
- `toggleTasksCompleted(ids: [String!]!, isCompleted: Boolean!)`
- `deleteSteps(ids: [String!]!)`
- `deleteLists(ids: [String!]!)`

### Optimistické updaty

Apollo cache se aktualizuje okamžitě (evict pro smazání, modify pro update). Mutace běží na pozadí. Při chybě Apollo rollbackne cache + toast notifikace.

## Drag & Drop

### Chování

- **Tažení vybrané položky:** Táhnou se všechny vybrané
- **Tažení nevybrané položky:** Výběr se zruší, táhne se jen ta jedna

### DragOverlay

Stack reprezentace: jméno první položky + badge s počtem (např. „Buy milk +3").
Nevybrané tažené položky zobrazeny se sníženou opacitou.

### Drop targets

- **Tasky → jiný seznam:** Bulk přesun (updateTasks — listId)
- **Tasky mezi tasky:** Bulk přeřazení jako blok (sortOrder)
- **Seznamy v sidebaru:** Přeřazení pořadí

### Persistence

Apollo cache persistence běží přes IndexedDB — optimistické updaty se automaticky zapíšou a přežijí refresh/offline.

## Edge cases

- **Escape:** Zruší výběr
- **Přepnutí seznamu:** Zruší výběr tasků
- **Smazání vybrané položky:** Automaticky ji odstraní z výběru
- **Prázdný výběr:** Kontext menu se neukáže
- **Bulk mutace selhání:** Optimistický update → rollback + toast
- **Drag nevybrané:** Výběr se zruší, táhne se jen jedna
- **Žádný limit na výběr:** UI musí zvládnout i 100+ položek

## Testování

- **Unit testy:** `useSelectionBehavior` — click, shift+click, cmd+click, escape, select all
- **Unit testy:** Bulk mutation resolvers — deleteTasks, updateTasks, toggleTasksCompleted
- **Integrační:** Kontext menu zobrazení/skrytí na vybraných/nevybraných položkách
- **Edge case testy:** Smazání vybrané položky, přepnutí listu resetuje výběr
