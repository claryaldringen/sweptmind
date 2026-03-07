# Homepage Design — SweptMind

## Kontext

Aktuální homepage je minimální (logo, tagline, 2 CTA buttony). Cíl: vytvořit přesvědčivý one-pager, který vysvětlí GTD principy jednoduše pro širokou veřejnost a ukáže jak SweptMind pomáhá.

## Cílová skupina

Široká veřejnost — lidé, kteří chtějí organizovat úkoly. Přístupný, vysvětlující tón. GTD principy jednoduše.

## Přístup: Storytelling flow

Stránka provádí návštěvníka příběhem: "Znáš ten chaos? → GTD ti pomůže → SweptMind to dělá jednoduše → Začni teď."

## Sekce

### 1. Hero

- Logo (CheckCircle2) + "SweptMind"
- Velký headline: "Ukliď si hlavu. Zvládni vše." / "Clear your mind. Get things done."
- Popis: krátký odstavec o GTD-inspirované appce
- CTA: [Začít] primary + [Přihlásit se] outline
- Jemný CSS gradient/pattern na pozadí

### 2. Co je GTD?

- Nadpis sekce: "Metoda, která funguje" / "A method that works"
- 3 karty s ikonami:
  - **Zapiš vše** (Inbox icon) — Vysyp z hlavy všechno, co tě napadne
  - **Roztřiď** (FolderOpen icon) — Přiřaď úkolům seznamy, termíny a priority
  - **Udělej** (Zap icon) — Soustřeď se jen na to, co je teď důležité
- Krátký popis pod každou kartou

### 3. Jak ti SweptMind pomáhá

- Nadpis: "Všechno co potřebuješ" / "Everything you need"
- 2×2 nebo 2×3 grid feature karet:
  - **Chytré seznamy** (ListTodo) — Organizuj úkoly do seznamů a skupin
  - **Plánování** (Calendar) — Due dates, remindery, chytrá viditelnost
  - **Opakování** (Repeat) — Denní, týdenní, měsíční opakující se úkoly
  - **Lokace** (MapPin) — Úkoly vázané na místo, nearby přehled
  - **Štítky** (Tag) — Kategorizuj a filtruj napříč seznamy
- Každá karta: ikona + název + 1-2 věty popisu

### 4. Footer CTA

- "Připraven/a začít?" / "Ready to start?"
- [Vytvořit účet zdarma] primary button
- Odkaz na přihlášení pro existující uživatele

## Technická rozhodnutí

- **Server component** — redirect přihlášených na `/planned` (zachovat stávající logiku)
- **Tailwind CSS only** — žádné externí animační knihovny
- **Bilingvální** — rozšíření `landing` sekce v i18n slovnících (cs + en)
- **Dark mode** — přes existující theme systém (CSS proměnné)
- **Responsive** — mobile-first, na desktopu wider layout s `max-w-6xl`
- **Lucide ikony** — CheckCircle2, Inbox, FolderOpen, Zap, ListTodo, Calendar, Repeat, MapPin, Tag
- **Žádné obrázky** — čistý typografický + ikonový design
- **Jediný soubor** — `src/app/page.tsx` (přepsat stávající)
- **i18n typy** — rozšířit `Dictionary.landing` o nové klíče

## Soubory k úpravě

1. `src/lib/i18n/types.ts` — rozšířit `landing` interface
2. `src/lib/i18n/dictionaries/cs.ts` — české překlady
3. `src/lib/i18n/dictionaries/en.ts` — anglické překlady
4. `src/app/page.tsx` — kompletní přepis homepage
