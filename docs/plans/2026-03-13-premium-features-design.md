# SweptMind Premium — Design

## Cíl

Přidat freemium model do SweptMind. Všechny stávající funkce zůstávají zdarma. První premium funkce: přílohy k úkolům (file attachments). Další v plánu: AI asistent.

## Platební model

- **Freemium** — jeden premium tier
- **Cena EUR:** 2 €/měsíc nebo 20 €/rok (2 měsíce zdarma)
- **Cena CZK:** 49 Kč/měsíc nebo 490 Kč/rok (2 měsíce zdarma)

## Platební metody

### Stripe (karty, EUR)

- Stripe Checkout Session → redirect na platební stránku → redirect zpět
- Stripe Customer Portal → uživatel si sám spravuje předplatné (změna plánu, zrušení, faktury)
- Stripe Tax → automatická DPH v EU
- Stripe webhooky na `/api/stripe/webhook`:
  - `checkout.session.completed` — nová subscription
  - `invoice.paid` — platba proběhla (renewal)
  - `customer.subscription.updated` — změna plánu
  - `customer.subscription.deleted` — zrušení

### FIO banka (QR platba, CZK)

- Uživatel zvolí "Platba převodem" → vygeneruje se QR kód ve formátu SPAYD
- QR obsahuje: číslo účtu FIO, částku v CZK, variabilní symbol = `userId`
- Uživatel naskenuje QR v bankovní appce a zaplatí
- **Vercel Cron** periodicky volá FIO API (`/last/` endpoint), kontroluje příchozí platby
- Spáruje platbu podle variabilního symbolu → aktivuje/prodlouží subscription
- Env proměnná: `FIO_API_TOKEN`

## Databázové schéma

### Tabulka `subscriptions`

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | uuid | PK |
| userId | uuid | FK → users |
| status | enum | active, canceled, past_due, expired |
| plan | enum | monthly, yearly |
| paymentMethod | enum | stripe, bank_transfer |
| stripeCustomerId | text? | Stripe customer ID |
| stripeSubscriptionId | text? | Stripe subscription ID |
| currentPeriodStart | timestamp | Začátek aktuálního období |
| currentPeriodEnd | timestamp | Konec aktuálního období |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Tabulka `bank_payments`

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | uuid | PK |
| userId | uuid | FK → users |
| amount | decimal | Částka v CZK |
| variableSymbol | text | = userId |
| fioTransactionId | text | Unikátní ID transakce z FIO |
| receivedAt | timestamp | Datum přijetí platby |
| createdAt | timestamp | |

### Tabulka `task_attachments`

| Sloupec | Typ | Popis |
|---------|-----|-------|
| id | uuid | PK |
| taskId | uuid | FK → tasks |
| fileName | text | Původní název souboru |
| fileSize | integer | Velikost v bytech |
| mimeType | text | MIME typ |
| blobUrl | text | Vercel Blob URL |
| createdAt | timestamp | |

## Subscription infrastruktura

- Pole `isPremium` na `User` entitě — computed z aktivní subscription (status = active, currentPeriodEnd > now)
- GraphQL: `isPremium` field na `UserType`, `createCheckoutSession` a `createCustomerPortalSession` mutace
- Middleware/guard v domain services kontroluje premium status před operacemi s přílohami

## Přílohy k úkolům

- **Storage:** Vercel Blob
- **Limity:** Max 10 MB na soubor, max 1 GB celkový storage na uživatele
- **Upload flow:** Klient → GraphQL mutace → server vytvoří signed Vercel Blob upload → uloží metadata do DB
- **UI:** Sekce příloh v task detail panelu (drag & drop + tlačítko "Přidat přílohu")

### Free vs Premium UX

| Akce | Free | Premium |
|------|------|---------|
| Vidět seznam příloh (název, velikost, ikona) | Ano | Ano |
| Nahrát přílohu | Ne — CTA "Upgrade na Premium" | Ano |
| Stáhnout přílohu | Ne — CTA "Upgrade na Premium" | Ano |
| Smazat přílohu | Ne | Ano |

**Scénář expirovaného premium:** Soubory zůstávají v Vercel Blob. Uživatel vidí seznam příloh, ale nemůže nahrávat, stahovat ani mazat. Motivace k obnovení předplatného.

## Bezpečnost

- Upload pouze přes server-side Vercel Blob `put()` (signed URL)
- Download: GraphQL query ověří vlastnictví tasku + aktivní premium → vrátí blob URL
- Rate limiting na upload endpoint
- Validace MIME typů a velikosti na serveru

## Env proměnné (nové)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_MONTHLY_ID` — Stripe Price ID pro měsíční plán
- `STRIPE_PRICE_YEARLY_ID` — Stripe Price ID pro roční plán
- `FIO_API_TOKEN` — token pro FIO banka API
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token (Vercel auto-provides)

## Budoucí premium funkce

- AI asistent (návrhy úkolů, chytré kategorizace, shrnutí)
- Další dle potřeby
