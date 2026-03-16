# Google Calendar Sync — Design

## Cíl

Obousměrná synchronizace úkolů s Google Calendar API. Push tasků do Google Calendar při změnách, pull změn zpět přes Google Push Notifications (webhooks). Last-write-wins conflict resolution.

## Přístup

Přímá integrace s Google Calendar API (ne background worker). Uživatel se přihlašuje přes Google OAuth — rozšíříme scope o `calendar.events`. Stávající uživatelé projdou re-consent flow z Settings. Apple Calendar propojený s Google automaticky vidí změny.

## OAuth & Token Management

- Google OAuth je už nakonfigurovaný v `src/lib/auth.ts`
- Tokeny (`access_token`, `refresh_token`) se ukládají v tabulce `accounts`
- Přidáme scope `https://www.googleapis.com/auth/calendar.events` do Google provider
- **Re-consent flow**: V Settings tlačítko "Připojit Google Calendar" spustí nový OAuth s `prompt: "consent"` a rozšířeným scope
- **Token refresh**: `refresh_token` z `accounts` pro automatické obnovení `access_token` přes Google OAuth2 endpoint
- **Disconnect**: Tlačítko "Odpojit" revokuje calendar scope a smaže sync záznamy

## Push: SweptMind → Google Calendar

Při změně úkolu s `dueDate` obsahujícím čas (nebo `dueDateEnd`):

- **Google Calendar Service** (`src/domain/services/google-calendar.service.ts`):
  - `pushTaskToGoogle(userId, task)` — `calendar.events.insert` / `calendar.events.patch`
  - `deleteGoogleEvent(userId, eventId)` — `calendar.events.delete`
- **Mapování**:
  - `task.title` → `summary`
  - `task.notes` → `description`
  - `dueDate` → `start.dateTime`
  - `dueDateEnd` → `end.dateTime` (pokud existuje, jinak `start + 1h`)
- **Tracking**: Sloupec `google_calendar_event_id` v `calendar_sync` tabulce
- **Trigger**: V `task.service.ts` po úspěšném uložení — fire-and-forget (neblokuje UI)

## Pull: Google Calendar → SweptMind

**Google Push Notifications (webhooks)**:

- Endpoint `/api/google-calendar/webhook` přijímá notifikace o změnách
- Při notifikaci: `calendar.events.list` s `syncToken` pro inkrementální diff
- Mapování zpět: `summary` → `title`, `description` → `notes`, `start/end` → `dueDate/dueDateEnd`
- **Conflict resolution**: Last-write-wins — porovnáme `updatedAt` timestamp

**Watch registration**:

- Při zapnutí sync zaregistrujeme watch přes `calendar.channels.watch`
- Watch expiruje (typicky 7 dní) — cron job pro renewal
- Při odpojení: `calendar.channels.stop`

## Settings UI

V Settings sekce "Google Calendar":

- **Stav připojení**: "Připojeno" / "Nepřipojeno" s Google účtem
- **Připojit/Odpojit** tlačítko
- **Sync směr**: Obousměrný (default), Jen push, Jen pull
- **Kalendář**: Výběr cílového kalendáře (primary default)

## DB Changes

```sql
-- users tabulka
google_calendar_sync_enabled BOOLEAN DEFAULT false
google_calendar_sync_direction TEXT DEFAULT 'both'  -- 'both' | 'push' | 'pull'
google_calendar_id TEXT DEFAULT 'primary'
google_calendar_sync_token TEXT  -- inkrementální sync token

-- calendar_sync tabulka
google_calendar_event_id TEXT
```

## Architektura flow

```
[User edits task] → task.service → google-calendar.service.pushTaskToGoogle()
                                        ↓
                                  Google Calendar API
                                        ↓
                              [Apple Calendar sees change]

[Google Calendar change] → /api/google-calendar/webhook
                                        ↓
                          google-calendar.service.pullChanges()
                                        ↓
                               task.service.update()
```

## Rozhodnutí

- **Přístup**: Direct Google Calendar API (ne background worker) — jednodušší, real-time
- **Conflict resolution**: Last-write-wins
- **Pull mechanismus**: Google Push Notifications (webhooks), ne polling
- **Scope**: `calendar.events` (ne `calendar` full access)
