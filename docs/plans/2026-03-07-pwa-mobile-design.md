# PWA Mobile App — Design

## Kontext

SweptMind je webová Next.js appka. Cíl: plnohodnotná mobilní zkušenost. Strategie: PWA-first (fáze 1), Capacitor pro store distribuce (fáze 2).

## Přístup: PWA-first

Přeměníme existující Next.js appku na instalovatelnou PWA s offline režimem a push notifikacemi. Žádný rewrite, žádný nový framework — rozšíříme to, co máme.

## 1. Responsivní UI

### Sidebar → Drawer na mobilu

- Breakpoint: `md` (768px). Pod ním sidebar jako shadcn `Sheet` (side="left").
- `AppShell` detekuje breakpoint přes `useMediaQuery("(min-width: 768px)")`.
- Na mobilu: hamburger tlačítko v horním baru otevírá drawer.
- Na desktopu: sidebar zůstává fixní jako doteď.
- Po výběru seznamu v draweru se drawer automaticky zavře.

### Task detail panel

- Na mobilu: fullscreen overlay (ne boční panel).
- Zpět tlačítko místo × pro zavření.

### Touch-friendly interakce

- Context menu: long-press (shadcn to řeší automaticky).
- Hover-only prvky (delete ikona na task-item): na touch zařízeních always-visible.
- Bottom safe area: `pb-safe` pro iOS notch/home indicator.
- Drag & drop: touch sensory z @dnd-kit už fungují.

## 2. PWA Manifest + Ikony

### `src/app/manifest.ts`

```typescript
export default function manifest() {
  return {
    name: "SweptMind",
    short_name: "SweptMind",
    description: "GTD-inspired task management",
    start_url: "/lists",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

### Viewport + meta v `layout.tsx`

- `viewport` export s `width: "device-width"`, `initialScale: 1`, `viewportFit: "cover"`
- `themeColor` v metadata
- `appleWebApp: { capable: true, statusBarStyle: "default", title: "SweptMind" }`

### Ikony

- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
- `public/icons/apple-touch-icon.png` (180x180)
- Vygenerované z jednoduchého placeholderu nebo existujícího designu.

## 3. Service Worker (Serwist)

[Serwist](https://serwist.pages.dev/) — moderní fork next-pwa pro App Router.

### Strategie cachování

- **Statické assety** (JS, CSS, fonty, ikony): cache-first (precache při instalaci)
- **API requesty** (`/api/graphql`): network-first, fallback na cached response
- **HTML stránky**: network-first
- **Obrázky**: cache-first s expirací 30 dní

### Instalace

```bash
yarn add serwist @serwist/next
```

Konfigurace v `next.config.ts` přes `withSerwist()` wrapper.

## 4. Offline režim

### Apollo Cache Persistence

```bash
yarn add apollo3-cache-persist
```

V `src/lib/apollo/provider.tsx`:

```typescript
import { persistCache, LocalForageWrapper } from "apollo3-cache-persist";
import localforage from "localforage";

// Při inicializaci:
await persistCache({
  cache,
  storage: new LocalForageWrapper(localforage),
});
```

Cache se automaticky serializuje do IndexedDB. Při startu se načte → uživatel vidí data ihned.

### Retry Link

```typescript
import { RetryLink } from "@apollo/client/link/retry";

const retryLink = new RetryLink({
  delay: { initial: 1000, max: 10000, jitter: true },
  attempts: { max: 5, retryIf: (error) => !!error },
});
```

Failed requesty se automaticky opakují po obnovení spojení.

### Optimistic UI

Na `createTask`, `updateTask`, `deleteTask`, `toggleTaskCompleted` mutacích — `optimisticResponse` v Apollo hooks. Změna se projeví ihned, request jde na pozadí.

### Offline indikátor

Jednoduchý banner nahoře stránky: "Offline — změny se synchronizují po připojení". Detekce přes `navigator.onLine` + `online`/`offline` event listenery.

### Conflict resolution

Last-write-wins na základě `updatedAt`. Server vždy vyhraje. Pro MVP dostatečné.

## 5. Push notifikace

### Flow

1. Uživatel zapne "Push notifikace" v Settings
2. Browser prompt → uživatel povolí
3. Vygeneruje se push subscription (endpoint + keys)
4. Uloží se přes GraphQL mutaci do DB

### DB — nová tabulka `push_subscriptions`

```
id: uuid PK
userId: text FK → users
endpoint: text NOT NULL
p256dh: text NOT NULL
auth: text NOT NULL
createdAt: timestamp
```

Index na userId. Uživatel může mít více subscriptions (telefon + desktop + tablet).

### Backend

- **VAPID klíče**: env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (vygenerované přes `web-push generate-vapid-keys`)
- **`web-push`** npm balík pro odesílání notifikací
- **API routes**:
  - `POST /api/push/subscribe` — uloží subscription
  - `POST /api/push/unsubscribe` — smaže subscription
  - `POST /api/push/send` — Vercel Cron (každých 5 min), najde tasky kde dueDate s časem ≤ now a notifikace nebyla poslána

### Nový sloupec na tasks

- `notifiedAt: timestamp` — kdy byla poslední push notifikace. Null = nebyla poslána.

### Service Worker

Service worker přijímá `push` event a zobrazuje notifikaci. Klik na notifikaci otevře appku na daném tasku (`?task=<id>`).

### Settings UI

Nový toggle "Push notifikace" v Settings:
- Povoleno / Zakázáno / Nepodporováno (starší prohlížeč)
- Pod togglem text vysvětlující, že na iOS je potřeba nejdřív instalovat appku na plochu.

## Soubory (odhad)

| Oblast | Nové/Upravené soubory |
|--------|----------------------|
| Responsivní UI | app-shell.tsx, sidebar.tsx, task-detail-panel.tsx, mobile-header.tsx |
| PWA | manifest.ts, layout.tsx, icons/ (4 soubory) |
| Service Worker | serwist config, sw.ts, next.config.ts |
| Offline | apollo/provider.tsx, offline-indicator.tsx |
| Push | push_subscriptions schema, push.service.ts, api/push/ routes, settings/page.tsx, sw.ts |
| i18n | en.ts, cs.ts, types.ts |
