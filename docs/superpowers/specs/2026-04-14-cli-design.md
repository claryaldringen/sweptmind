# SweptMind CLI — Design Spec

## Přehled

CLI nástroj `sm` pro ovládání SweptMind z terminálu. Slouží pro osobní produktivitu (rychlé přidávání/správa úkolů bez prohlížeče) i automatizaci (scripting, cron joby, AI agenti).

**Balíček:** `@sweptmind/cli` v `packages/cli/`, publikovaný na npm registry.  
**Globální příkaz:** `sm` (po `npm install -g @sweptmind/cli`)  
**Cílová skupina:** Všichni uživatelé SweptMind (ne jen admin).

## Stack

- **CLI framework:** Commander.js
- **GraphQL klient:** graphql-request
- **Formátování:** chalk
- **Konfigurace:** conf (XDG-compliant)
- **Typy:** GraphQL Codegen (sdílené `.graphql` operace z `src/graphql/`)

## Příkazová struktura

Noun-verb pattern. Hezký formátovaný výstup jako default, `--json` flag pro strojové zpracování.

### Autentizace

```
sm login                    # OAuth flow (otevře prohlížeč)
sm login --token <token>    # API token pro scripting
sm logout
sm whoami
```

### Úkoly

```
sm task add "Title" [--list <id|name>] [--due 2026-04-15] [--reminder 2026-04-14T09:00]
sm task list [--list <id|name>] [--planned] [--completed] [--with-location]
sm task show <id>
sm task edit <id> [--title "..."] [--notes "..."] [--due ...] [--reminder ...]
sm task complete <id>
sm task uncomplete <id>
sm task delete <id>
sm task move <id> --list <id|name>
sm task import <file.json>
sm task clone <id>
```

### Kroky (subtasks)

```
sm step add <task-id> "Krok 1"
sm step list <task-id>
sm step complete <step-id>
sm step delete <step-id>
```

### Seznamy

```
sm list ls
sm list create "Nákupy"
sm list show <id|name>
sm list edit <id> [--name "..."]
sm list delete <id>
sm list reorder <id> --position <n>
```

### Skupiny seznamů

```
sm group ls
sm group create "Práce"
sm group delete <id>
```

### Lokace

```
sm location ls
sm location create "Kancelář" --lat 50.08 --lng 14.42 --radius 200
sm location edit <id> [--name ...] [--lat ...] [--lng ...] [--radius ...]
sm location delete <id>
```

### Sdílení

```
sm share add <task-id> --user <email>
sm share remove <task-id> --user <email>
sm share list <task-id>
sm connection ls
sm connection invite <email>
sm connection remove <id>
```

### Kalendář

```
sm calendar sync
```

### Předplatné

```
sm subscription status
```

### Konfigurace

```
sm config set <key> <value>
sm config get <key>
sm config ls
sm config reset
```

## Autentizace

### OAuth flow (interaktivní)

1. `sm login` spustí lokální HTTP server na random portu (např. `localhost:9876`)
2. Otevře prohlížeč na `https://sweptmind.com/cli/auth?callback=http://localhost:9876/callback`
3. Uživatel se přihlásí přes Google/Facebook (stávající Auth.js flow)
4. Server přesměruje zpět s krátkodobým auth kódem
5. CLI vymění kód za API token (endpoint `POST /api/cli/token`)
6. Token se uloží do `~/.config/sm/config.json`

### API token (scripting)

1. Uživatel si vygeneruje token v Settings na webu (sekce "API Tokens")
2. `sm login --token <token>` uloží token do configu
3. Alternativně env var `SM_TOKEN` (má přednost před configem)

### Token formát

Dlouhodobý opaque token s prefixem `sm_` (např. `sm_a1b2c3...`). Uložený v DB tabulce `api_tokens` (user_id, token_hash, name, created_at, last_used_at).

### Priorita autentizace

`SM_TOKEN` env var → `--token` flag → `~/.config/sm/config.json`

### Nové serverové komponenty

- **DB tabulka `api_tokens`** — user_id, token_hash, name, created_at, last_used_at
- **`POST /api/cli/token`** — výměna auth kódu za API token
- **`POST /api/cli/token/create`** — vytvoření API tokenu (z web UI)
- **`DELETE /api/cli/token/:id`** — revokace tokenu
- **GraphQL middleware** — rozpoznání API tokenu (header `Authorization: Bearer sm_...`) vedle session cookie
- **Stránka `/cli/auth`** — OAuth consent screen pro CLI
- **Settings sekce "API Tokens"** — generování a revokace tokenů ve web UI

## Komunikace se serverem

**Protokol:** GraphQL přes HTTP POST na `{apiUrl}/api/graphql` s hlavičkou `Authorization: Bearer <token>`.

**Sdílení operací:** CLI importuje `.graphql` soubory z `src/graphql/queries/` a `src/graphql/mutations/`. Codegen generuje TypeScript typy do `packages/cli/src/generated/graphql.ts`.

**Codegen konfigurace** v `packages/cli/codegen.ts`:
- Schema: introspekce z běžícího serveru nebo sdílený schema soubor
- Documents: `../../src/graphql/**/*.graphql`
- Output: `src/generated/graphql.ts`

**API URL:** Default `https://sweptmind.com`, konfigurovatelné přes `sm config set api-url <url>`.

**Error handling:**
- HTTP 401 → `Nepřihlášen. Spusť 'sm login'.`
- GraphQL errors → zobrazí message z response
- Network errors → `Nelze se připojit k serveru. Zkontroluj připojení nebo 'sm config get api-url'.`
- Timeout: 10s default

## Výstup a formátování

### TTY (default)

Barevný, čitelný výstup přes chalk:

```
$ sm task list --list Nákupy
 ☐  #42  Nakoupit mléko          📅 zítra
 ☑  #38  Koupit chleba            📅 dnes
 ☐  #45  Vitamíny                 

3 úkoly (1 dokončený)
```

```
$ sm task add "Nový úkol" --list Nákupy
✓ Úkol #47 vytvořen v seznamu Nákupy
```

### Strojový režim (`--json`)

Čistý JSON na stdout, žádné barvy ani dekorace:

```
$ sm task list --list Nákupy --json
[{"id":"42","title":"Nakoupit mléko","isCompleted":false,"dueDate":"2026-04-15",...}]
```

### Auto-detekce

`process.stdout.isTTY` — pokud není TTY (pipe), automaticky přepne na JSON i bez `--json` flagu.

## Konfigurace

**Soubor:** `~/.config/sm/config.json`

```json
{
  "apiUrl": "https://sweptmind.com",
  "token": "sm_a1b2c3...",
  "locale": "cs",
  "defaultList": "Tasks"
}
```

**Knihovna:** `conf` — XDG-compliant, atomické zápisy.

**Validní klíče:**
- `apiUrl` — URL serveru (default: `https://sweptmind.com`)
- `token` — autentizační token
- `locale` — jazyk výstupu CLI (cs/en)
- `defaultList` — default seznam pro `sm task add` bez `--list`

## Struktura balíčku

```
packages/cli/
├── package.json            # @sweptmind/cli, bin: { "sm": "./dist/index.js" }
├── tsconfig.json
├── codegen.ts              # GraphQL Codegen konfigurace
├── src/
│   ├── index.ts            # Entry point, Commander program setup
│   ├── commands/
│   │   ├── auth.ts         # login, logout, whoami
│   │   ├── task.ts         # task add/list/show/edit/complete/uncomplete/delete/move/import/clone
│   │   ├── step.ts         # step add/list/complete/delete
│   │   ├── list.ts         # list ls/create/show/edit/delete/reorder
│   │   ├── group.ts        # group ls/create/delete
│   │   ├── location.ts     # location ls/create/edit/delete
│   │   ├── share.ts        # share add/remove/list
│   │   ├── connection.ts   # connection ls/invite/remove
│   │   ├── calendar.ts     # calendar sync
│   │   ├── subscription.ts # subscription status
│   │   └── config.ts       # config set/get/ls/reset
│   ├── lib/
│   │   ├── client.ts       # graphql-request klient s auth
│   │   ├── config.ts       # conf wrapper
│   │   ├── output.ts       # formátování (TTY vs JSON)
│   │   └── auth.ts         # OAuth flow (lokální HTTP server + open browser)
│   └── generated/
│       └── graphql.ts      # Vygenerované typy (codegen)
└── dist/                   # Zkompilovaný výstup
```
