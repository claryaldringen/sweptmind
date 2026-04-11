# SweptMind — Migrace z Vercel na Hetzner VPS

## Motivace

- Úspora nákladů (Vercel se prodražuje)
- Větší kontrola nad infrastrukturou

## Cílový stav

SweptMind běží na existujícím Hetzner VPS (204.168.176.128) jako standalone Next.js server spravovaný přes pm2, za Caddy reverse proxy s auto HTTPS. Žádné Vercel závislosti.

## Infrastruktura a deployment

- **Port:** 3005
- **Adresář:** `/opt/sweptmind`
- **Next.js standalone:** `output: "standalone"` v `next.config.ts` → `.next/standalone/server.js`
- **pm2 name:** `sweptmind`
- **Environment:** `/opt/sweptmind/.env.local`

### Caddy konfigurace

```
sweptmind.com {
    handle /uploads/* {
        root * /opt/sweptmind-uploads
        file_server
    }
    handle {
        reverse_proxy localhost:3005
    }
}
```

### Deploy proces (manuální)

1. SSH na server
2. `cd /opt/sweptmind && git pull`
3. `yarn install --frozen-lockfile && yarn build`
4. `pm2 restart sweptmind`

## Databáze

Nová PostgreSQL databáze na existujícím PostgreSQL 16 serveru.

```sql
CREATE DATABASE sweptmind;
CREATE USER sweptmind WITH PASSWORD '...';
GRANT ALL PRIVILEGES ON DATABASE sweptmind TO sweptmind;
```

- **DATABASE_URL:** `postgresql://sweptmind:<heslo>@localhost:5432/sweptmind`
- **Migrace dat:** `pg_dump` z Vercel Postgres → `pg_restore` na Hetzner
- **Schéma management:** Beze změn — `yarn db:push` po deployi

## Blob storage (přílohy)

Lokální filesystem místo Vercel Blob.

- **Úložiště:** `/opt/sweptmind-uploads/attachments/{userId}/{taskId}/{fileName}`
- **Serving:** Caddy servíruje `/uploads/*` přímo z disku (žádné zatížení Node.js)

### Nová implementace `IBlobStorage`

`LocalFilesystemBlobStorage` (`src/infrastructure/blob/local-filesystem-blob-storage.ts`):

- `put()` — zapíše soubor na disk, vrátí URL `/uploads/attachments/{userId}/{taskId}/{fileName}`
- `del()` — smaže soubor z disku

### Upload flow

- **Bylo:** Klient uploaduje přímo na Vercel Blob přes signed token (client-side)
- **Nově:** Klient uploaduje na `POST /api/upload`, server uloží na disk
- Token endpoint (`/api/upload/token`) se ruší — nepotřebný

### Migrace existujících příloh

Stáhnout z Vercel Blob a uložit do `/opt/sweptmind-uploads/`. Případně začít čistě, pokud je příloh málo.

## Cron joby

3 joby z `vercel.json` → systemd timery (konzistentní s ostatními appkami na serveru).

| Job | Timer | Schedule | Příkaz |
|-----|-------|----------|--------|
| Push notifikace | `sweptmind-push.timer` | Denně v 8:00 | `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3005/api/push/send` |
| Google Calendar sync | `sweptmind-gcal-sync.timer` | Každých 5 minut | `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3005/api/cron/sync-google-calendar` |
| Renew Google watches | `sweptmind-gcal-renew.timer` | Denně v 3:00 | `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3005/api/cron/renew-google-watches` |

Každý job má:
- `/etc/systemd/system/sweptmind-<name>.service` — curl příkaz
- `/etc/systemd/system/sweptmind-<name>.timer` — schedule

Autentizace: Bearer token z `CRON_SECRET` env var — beze změny v kódu.

## Změny v kódu

### 1. `next.config.ts`

- Přidat `output: "standalone"`
- Odstranit `VERCEL_GIT_COMMIT_SHA` z env
- Aktualizovat CSP headers: odstranit `*.public.blob.vercel-storage.com`, přidat `'self'` pro uploads

### 2. Nový `LocalFilesystemBlobStorage`

`src/infrastructure/blob/local-filesystem-blob-storage.ts` — implementace `IBlobStorage` portu pro lokální filesystem.

### 3. Upload API route

Přepsat `src/app/api/upload/` na server-side upload místo Vercel Blob client-side flow.

### 4. `task-attachments.tsx`

Místo `@vercel/blob/client` put → standardní `fetch POST` na `/api/upload`. Progress tracking přes XMLHttpRequest.

### 5. `src/infrastructure/container.ts`

Přepojit `IBlobStorage` na `LocalFilesystemBlobStorage`.

### 6. Cleanup

- Odebrat `@vercel/blob` a `@neondatabase/serverless` z `package.json`
- Smazat `vercel.json`
- Smazat `src/infrastructure/blob/vercel-blob-storage.ts`
- Smazat token endpoint `src/app/api/upload/token/route.ts`

### Beze změny

- Domain vrstva (entities, services, repositories)
- GraphQL vrstva
- Auth konfigurace
- Drizzle ORM / DB schéma

## Migrace a cutover

### Pořadí kroků

1. Připravit server — DB, adresáře, env vars, Caddy config
2. Code changes — standalone output, filesystem blob, upload route, cleanup
3. Build a nasadit na Hetzner — zatím bez DNS přesměrování
4. Otestovat — přes IP nebo dočasný subdomain
5. Migrovat data — pg_dump/restore z Vercel Postgres, stáhnout přílohy z Vercel Blob
6. DNS cutover — přesměrovat sweptmind.com A záznam na 204.168.176.128 v Subregistru
7. Ověřit — HTTPS, cron joby, push notifikace, přílohy
8. Zrušit Vercel — až po ověření stability (pár dní po cutoveru)

### Downtime

Minimální — DNS propagace (minuty až hodiny, záleží na TTL). Během propagace může část uživatelů chodit ještě na Vercel.

### Rollback plán

DNS zpět na Vercel. Vercel projekt zůstane aktivní dokud se neověří stabilita na Hetzneru.
