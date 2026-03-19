# CalDAV Calendar Sync — Design

## Kontext

SweptMind potřebuje obousměrnou synchronizaci tasků s kalendářovými službami (Google Calendar, Apple Calendar, Outlook, Thunderbird, atd.).

## Přístup: Vlastní CalDAV server

SweptMind vystaví CalDAV endpoint. Uživatel přidá URL do svého kalendáře a sync běží automaticky oběma směry. Jeden standard pokrývá všechny kalendářové služby.

### Výhody
- Jeden endpoint pro všechny providery
- Žádné OAuth tokeny třetích stran
- Funguje s jakýmkoliv CalDAV klientem
- Čistá architektura bez vendor lock-in

## Sync filtr (GTD filozofie)

**Default:** Synchronizují se pouze tasky s přesným časem v `dueDate` (formát `YYYY-MM-DDTHH:mm`). Diář je posvátný — jen pevné termíny.

**Settings toggle:** "Synchronizovat všechny tasky s termínem" — zapnutím se syncují i tasky jen s datem (`YYYY-MM-DD`). Default: vypnuto.

Uloženo v `users.calendarSyncAll` (boolean, default false).

## DB změny

### Existující tabulka `users` — nové sloupce
- `calendarSyncAll: boolean` (default false)
- `calendarToken: text` (nullable, unique) — CalDAV auth token

### Nová tabulka `calendar_sync`
```
id: uuid PK
userId: text FK → users
taskId: text FK → tasks
icalUid: text — UID z iCal
etag: text — verze pro conflict detection
lastSyncedAt: timestamp

UNIQUE(userId, icalUid)
INDEX(taskId)
```

Mapuje tasky na iCal UIDs pro rozpoznání update vs nový task a ETags pro conflict detection.

## API routes

```
src/app/api/caldav/[token]/
  ├── route.ts          — PROPFIND na principal/calendar discovery
  └── [...path]/
      └── route.ts      — GET/PUT/DELETE na jednotlivé .ics + REPORT
```

### Auth
Request na `/api/caldav/{token}/...` → lookup uživatele podle `calendarToken`. Token neexistuje → 401.

### CalDAV subset (implementujeme)
- `PROPFIND` — discovery (principal, calendar-home, calendar)
- `REPORT` (calendar-query, calendar-multiget) — fetch událostí
- `GET` — jednotlivé události jako .ics
- `PUT` — vytvoření/update události → vytvoří/updatne task
- `DELETE` — smazání události → smaže task
- ETags pro conflict detection

### Co NEimplementujeme (YAGNI)
- Více kalendářů per uživatel (jeden "SweptMind Tasks")
- ACL/sharing
- Free-busy dotazy
- VJOURNAL

## Discovery flow (PROPFIND)

```
Client:  PROPFIND /api/caldav/{token}/
Server:  → principal: /api/caldav/{token}/principal/
Client:  PROPFIND /api/caldav/{token}/principal/
Server:  → calendar-home: /api/caldav/{token}/calendars/
Client:  PROPFIND /api/caldav/{token}/calendars/
Server:  → calendar: /api/caldav/{token}/calendars/tasks/
Client:  PROPFIND /api/caldav/{token}/calendars/tasks/
Server:  → supported methods, CTag, displayname
```

## Sync flow

### App → Calendar (REPORT)
1. Kalendář posílá `REPORT calendar-query`
2. Server načte tasky z DB (filtr dle `calendarSyncAll`)
3. Konvertuje na VEVENT iCal
4. Vrátí multistatus response s ETags

### Calendar → App (PUT)
1. Kalendář posílá `PUT {uid}.ics`
2. Server parsuje iCal VEVENT
3. Hledá existující task podle `icalUid` v `calendar_sync`
4. Existuje → update task; neexistuje → nový task (do default listu)
5. Uloží/updatne `calendar_sync` záznam
6. Vrátí nový ETag

### Calendar → App (DELETE)
1. Kalendář posílá `DELETE {uid}.ics`
2. Server najde task podle `icalUid`
3. Smaže task + `calendar_sync` záznam

## Task ↔ iCal mapování

| Task field | iCal property |
|------------|---------------|
| title | SUMMARY |
| notes | DESCRIPTION |
| dueDate (date-only) | DTSTART (DATE) + DTEND (DATE, +1 day) |
| dueDate (s časem) | DTSTART (DATE-TIME) + DTEND (+1h default) |
| isCompleted | STATUS: COMPLETED / NEEDS-ACTION |
| recurrence | RRULE |
| id | UID |
| createdAt | CREATED |
| updatedAt | LAST-MODIFIED |

## Recurrence konverze

### SweptMind → iCal RRULE
| SweptMind | iCal RRULE |
|-----------|------------|
| `DAILY` | `RRULE:FREQ=DAILY` |
| `WEEKLY:1,3,5` | `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| `MONTHLY` | `RRULE:FREQ=MONTHLY` |
| `YEARLY` | `RRULE:FREQ=YEARLY` |

### Mapování dnů
SweptMind `0=SU, 1=MO, 2=TU, 3=WE, 4=TH, 5=FR, 6=SA` → iCal `SU, MO, TU, WE, TH, FR, SA`

## Domain vrstva

### Nové soubory
```
domain/
  entities/calendar-sync.ts
  repositories/calendar-sync.repository.ts
  services/calendar.service.ts

infrastructure/
  persistence/drizzle-calendar-sync.repository.ts

server/
  caldav/
    ical-converter.ts    — Task ↔ VEVENT konverze
    caldav-handler.ts    — CalDAV XML request/response parsing
    xml-builder.ts       — Multistatus XML responses
```

### CalendarService metody
- `getCalendarToken(userId)` — vrátí nebo vygeneruje token
- `regenerateToken(userId)` — nový token (invaliduje starý)
- `getSyncableTasks(userId)` — tasky pro CalDAV (dle filtru)
- `upsertFromIcal(userId, icalUid, vevent)` — vytvoř/updatuj task z iCal
- `deleteFromIcal(userId, icalUid)` — smaž task přes iCal UID
- `getSyncEntry(taskId)` — najdi sync záznam pro task
- `updateEtag(taskId, etag)` — po změně tasku z app

## Settings UI

Nová sekce "Kalendář" v Settings:

- **CalDAV URL** — readonly input s copy tlačítkem
- **Regenerovat token** — tlačítko s potvrzením
- **Synchronizovat všechny tasky s termínem** — toggle switch (default: off)
  - Popisek: "Výchozí: pouze tasky s přesným časem. Zapnutím se budou synchronizovat i tasky pouze s datem."
