# SweptMind

GTD-inspirovaná todo list aplikace (MVP klon Microsoft Todo). Později: Týdenní přehled, Kontexty, Někdy/Možná.

## Komunikace

Komunikuj se mnou vždy v češtině a tykej mi, jako kdybych byl tvůj kolega. Já jsem Martin.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** Tailwind CSS v4 + shadcn/ui + Lucide icons
- **ORM:** Drizzle ORM (PostgreSQL)
- **Auth:** Auth.js v5 (JWT strategie) — Google, Facebook, Credentials
- **GraphQL:** GraphQL Yoga + Pothos (schema builder) + Apollo Client v4
- **DnD:** @dnd-kit/core + @dnd-kit/sortable
- **Validace:** Zod v4
- **Testy:** Vitest (unit testy domain services)
- **Nativní:** Capacitor 6 (iOS + Android), Electron (macOS), Firebase Admin SDK (FCM/APNs)

## Příkazy

```bash
yarn dev                  # Spustit dev server (Turbopack)
yarn build                # Produkční build
yarn lint                 # ESLint kontrola
yarn format:check         # Prettier kontrola formátování
yarn typecheck            # TypeScript kontrola typů
yarn test                 # Spustit testy (Vitest)
yarn check                # Spustit vše: lint + format + typecheck + test
yarn db:push              # Pushnutí Drizzle schématu do DB
yarn db:generate          # Generování SQL migrací
yarn db:seed              # Seedování testovacích dat (tsx scripts/seed.ts)
yarn db:studio            # Drizzle Studio GUI
yarn codegen              # Generování GraphQL TypeScript typů
docker compose up -d      # Spustit lokální PostgreSQL

# Mobile (Capacitor)
cd apps/mobile && npx cap sync android    # Sync web → Android
cd apps/mobile && npx cap sync ios        # Sync web → iOS
cd apps/mobile && npx cap open android    # Otevřít v Android Studio
cd apps/mobile && npx cap open ios        # Otevřít v Xcode

# Desktop (Electron)
cd apps/desktop && yarn dev               # Dev mode (macOS)
cd apps/desktop && yarn build             # Build .dmg
```

## Struktura projektu

```
apps/
├── mobile/                # Capacitor (iOS + Android) — WebView shell
│   ├── capacitor.config.ts
│   ├── android/           # Auto-generated (gitignored)
│   └── ios/               # Auto-generated (gitignored)
├── desktop/               # Electron (macOS) — Dock persistence
│   ├── src/main.ts        # Main process
│   └── src/preload.ts     # electronAPI marker
packages/
└── native-bridge/         # Port/adapter pattern pro nativní funkce
    ├── src/ports/          # PushPort, LocationPort interfaces
    ├── src/adapters/web/   # Web Push, Geolocation API
    └── src/adapters/capacitor/  # FCM/APNs, Background Geolocation
src/
├── app/
│   ├── (auth)/           # Přihlášení, Registrace stránky
│   ├── (app)/            # Autentizované cesty (Plánované, Seznamy, Nastavení)
│   └── api/
│       ├── auth/         # Auth.js route handler
│       └── graphql/      # GraphQL Yoga endpoint
├── domain/                # Čistý TypeScript — žádné framework importy
│   ├── entities/          # Task, Step, List, ListGroup, User + DTO typy
│   ├── repositories/      # Port interfaces (ITaskRepository, IListRepository, ...)
│   └── services/          # Use cases — veškerá business logika
├── infrastructure/
│   ├── persistence/       # Drizzle implementace repository
│   └── container.ts       # Composition root: repos → services
├── server/
│   ├── db/
│   │   ├── index.ts       # Drizzle klient (node-postgres)
│   │   └── schema/        # auth.ts, lists.ts, tasks.ts, relations.ts
│   └── graphql/
│       ├── builder.ts     # Pothos SchemaBuilder (scope-auth plugin)
│       ├── schema.ts      # Finální sestavení schématu
│       ├── context.ts     # GraphQL kontext (services + userId)
│       └── types/         # refs.ts, user.ts, task.ts, step.ts, list.ts, list-group.ts, register.ts
├── lib/
│   ├── auth.ts            # Auth.js v5 konfigurace
│   ├── apollo/            # Apollo Client nastavení (client.ts, rsc-client.ts, provider.tsx)
│   ├── i18n/              # Lokalizace (cs/en slovníky, typy, provider)
│   ├── utils.ts           # cn() helper
│   └── validators.ts      # Zod schémata
├── components/
│   ├── ui/                # shadcn/ui primitivy
│   ├── layout/            # sidebar, user-menu
│   ├── tasks/             # task-list, task-item, task-input, task-detail-panel, sortable-*
│   ├── lists/             # create-list-dialog
│   ├── auth/              # login-form, register-form, oauth-buttons
│   └── providers/         # apollo, session, theme providers
├── graphql/               # Klientské .graphql operace (queries/, mutations/)
└── hooks/                 # use-keyboard-shortcuts, use-locale, use-task-count-mode
```

## Klíčová architektonická rozhodnutí

- **Clean Architecture:** Domain vrstva (entities, repositories, services) je oddělená od infrastructure (Drizzle) a serveru (GraphQL resolvery). Resolvery jsou jednořádkové delegáty na services.
- **Chytré seznamy** (Plánované) jsou vypočítané pohledy (filtrované dotazy), ne řádky v DB
- **Panel detailu úkolu** se otevírá přes `?task=<id>` URL search param
- **Pothos type refs** žijí v `types/refs.ts` aby se zabránilo kruhovým závislostem mezi typy
- **Apollo Client v4:** hooky se importují z `@apollo/client/react`, core z `@apollo/client`. `ApolloClient` + `InMemoryCache` z `@apollo/client-integration-nextjs` pro provider.
- **JWT sessions** (žádná sessions tabulka) — Credentials provider vyžaduje JWT strategii
- **Zod v4:** používá `.issues` (ne `.errors`) na ZodError
- **i18n:** Vlastní lokalizace (cs/en) bez externích knihoven. `useLocale()` hook (localStorage + cookie `sweptmind-locale`), `useTranslations()` vrací `t(key, params?)`. Slovníky v `src/lib/i18n/dictionaries/`. Pro server components: přímý import slovníku + čtení locale z cookies. Jazyk se přepíná v Settings.

## DB Schéma

- `users` — Auth.js uživatelé + hashedPassword
- `accounts` — OAuth účty (Auth.js adaptér)
- `verification_tokens` — Ověření emailu
- `list_groups` — Seskupení seznamů
- `lists` — Uživatelovy seznamy úkolů (jeden výchozí "Tasks" na uživatele)
- `tasks` — Úkoly s title, notes, isCompleted, dueDate (string), reminderAt (YYYY-MM-DD string, přebíjí automatickou viditelnost), sortOrder. Visibility pravidla: bez dueDate=vždy viditelný; date-only dueDate=viditelný ten den; dueDate s časem=viditelný den předem; reminderAt přebíjí automatiku
- `steps` — Podúkoly v rámci úkolu

## Workflow pravidla

- Po jakékoliv změně DB schématu (`src/server/db/schema/`) vždy automaticky spusť `yarn db:push` pro aplikaci změn do lokální databáze.
- **Po deployi na produkci (push na main):** Pokud se změnilo DB schéma, musíš pushout schéma i na produkční DB:
  ```bash
  ssh root@204.168.176.128 "cd /opt/sweptmind && yarn db:push"
  ```

## Deployment

- **Hosting:** Hetzner VPS (204.168.176.128), standalone Next.js za Caddy reverse proxy
- **Databáze:** PostgreSQL 16 na stejném serveru (localhost:5432, DB `sweptmind`)
- **Process manager:** pm2 (`sweptmind`), ecosystem config v `/opt/sweptmind/ecosystem.config.cjs`
- **Reverse proxy:** Caddy (auto HTTPS via Let's Encrypt), config v `/etc/caddy/Caddyfile`
- **Cron joby:** systemd timery (`sweptmind-push`, `sweptmind-gcal-sync`, `sweptmind-gcal-renew`)
- **Přílohy:** Lokální filesystem (`/opt/sweptmind-uploads/`), servírované přes Caddy na `/uploads/*`
- **Deploy postup:**
  ```bash
  ssh root@204.168.176.128 "cd /opt/sweptmind && git pull && yarn install && yarn build && pm2 restart sweptmind"
  ```

## Mobilní roadmap

### Fáze 1 (aktuální): PWA
- Responsivní UI (sidebar → drawer na mobilu)
- PWA manifest, ikony, service worker (Serwist)
- Offline režim (Apollo cache persistence v IndexedDB, retry link, optimistic UI)
- Push notifikace (Web Push API, VAPID, systemd timer)

### Fáze 2 (implementováno): Capacitor + Electron
- Capacitor wrapper (iOS + Android) — WebView shell načítající sweptmind.com
- Electron wrapper (macOS) — Dock persistence, nativní menu
- Nativní push přes FCM/APNs (Firebase Admin SDK) — hybridní model (web: VAPID, nativní: FCM)
- Background geolocation + geofencing (stabilní lokace: nativní geofencing, ad-hoc: periodické kontroly)
- Port/adapter pattern v `packages/native-bridge/` pro clean architecture
- Později: Biometrics, App badge count, Home screen widgets, Share target

## Prostředí

Vyžaduje `.env.local` s: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_FACEBOOK_ID/SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` (JSON string Firebase service account pro FCM/APNs push), `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY_ID`, `STRIPE_PRICE_YEARLY_ID`, `FIO_API_TOKEN` (FIO banka API token pro kontrolu plateb), `FIO_ACCOUNT_NUMBER` (FIO číslo účtu v IBAN formátu pro SPAYD QR kódy), `UPLOADS_PATH` (cesta k úložišti příloh, default `/opt/sweptmind-uploads`), `LLM_PROVIDER` (`ollama` nebo `openai`, default `ollama`), `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `llama3.1`), `LLM_API_KEY` (API klíč pro cloud LLM), `LLM_BASE_URL` (default `https://api.openai.com/v1`, OpenAI-compatible endpoint), `LLM_MODEL` (default `gpt-4o-mini`)
