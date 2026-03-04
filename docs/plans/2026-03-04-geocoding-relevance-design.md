# Geocoding: Relevance a lokalizace vyhledávání míst

## Problém

Vyhledávání míst (geocoding) trpí dvěma problémy:
1. **Relevance** — pro krátké dotazy ("Ra", "Ber") se nezobrazují blízká místa (Rakovník, Beroun), ale globálně významná (Ravenna, Berlin)
2. **Lokalizace** — výsledky nejsou v jazyce uživatele (český uživatel vidí "Deutschland" místo "Německo")

## Řešení: Hybrid Photon + Nominatim

Dva API v tandemu:
- **Photon** (photon.komoot.io) — autocomplete s nativním proximity biasem, filtr na `osm_tag=place`
- **Nominatim** `/lookup` — batch doplnění lokalizovaného `display_name` přes OSM ID v jazyce uživatele

## Flow

```
Uživatel píše → debounce (1s) → doSearch()
  1. Zjisti pozici (options.lat/lon ?? await IP fallback)
  2. Zjisti locale (cs / en)
  3. Photon: GET /api/?q=...&lat=...&lon=...&osm_tag=place&limit=15
  4. Z výsledků extrahuj OSM IDs (R12345, N67890...)
  5. Nominatim: GET /lookup?osm_ids=R12345,N67890,...&accept-language={locale}&format=json
  6. Seřaď podle vzdálenosti od uživatele
  7. Zkrať display_name na 3 části (název, region, země)
  8. Vrať top 5
```

## Formát výsledků

Nominatim `display_name` se zkrátí na **3 části**: první (název), předposlední (region), poslední (země).

| Plný display_name | Zkrácený |
|---|---|
| Beroun, SO POÚ Beroun, SO ORP Beroun, okres Beroun, Středočeský kraj, Střední Čechy, Česko | Beroun, Středočeský kraj, Česko |
| Berlín, Německo | Berlín, Německo |
| Bergen, Vestland, Norsko | Bergen, Vestland, Norsko |

Uložený název lokace v DB se nemění — stále `display_name.split(",")[0]`.

## Změny v kódu

### `src/hooks/use-geocode.ts`
- Přepis `doSearch()`: Photon search → Nominatim lookup → distance sort → format
- Nový parametr `locale: string` v `UseGeocodeOptions`
- Nová helper `shortenDisplayName(displayName: string): string`
- Photon response type `PhotonFeature` (geometry + properties s `osm_type`, `osm_id`)
- Nominatim lookup helper (batch fetch by OSM IDs)

### `src/components/tasks/task-detail-panel.tsx`
- Předat `locale` z `useTranslations()` do `useGeocode()`

### `src/app/(app)/lists/[listId]/page.tsx`
- Předat `locale` z `useTranslations()` do `useGeocode()`

## Co se nemění
- DB schéma
- GraphQL schema
- Komponenty UI (jen předání locale)
- IP fallback pro pozici
- Logika ukládání lokace (název = první část display_name)
