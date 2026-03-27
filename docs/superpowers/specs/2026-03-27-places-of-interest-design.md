# Places of Interest — Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Context

Waymark is a server-rendered Astro app for sharing trip itineraries. Users want a "Places of Interest" (POI) feature — a curated list of recommended places (restaurants, shops, attractions, etc.) that aren't yet on the itinerary. POIs are per-trip, browsable on a separate tab within the trip page, filterable by city and category, and manageable via a new Claude skill backed by dedicated admin API endpoints.

---

## Data Model

Extend `src/types/itinerary.ts` with two new schemas and update `ItinerarySchema`:

```typescript
const PoiCategorySchema = z.enum([
  'restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other'
]);

const PlaceOfInterestSchema = z.object({
  id: z.string(),                           // nanoid, generated server-side
  name: z.string(),
  category: PoiCategorySchema,
  city: z.string(),                         // free-form; used for filter
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  website: z.string().url().optional(),
  googleMapsUrl: z.string().url().optional(),
  description: z.string().optional(),
  advisorNotes: z.string().optional(),      // travel advisor notes, distinct from description
});

// Added to ItinerarySchema (backward-compatible):
pois: z.array(PlaceOfInterestSchema).optional().default([]),
```

City filter options are derived at render time by collecting unique `city` values from the `pois` array — no separate configuration needed.

---

## Page & Component Architecture

### Tab routing

`src/pages/trip/[id].astro` reads a `?tab` query param (default: `itinerary`). A `TripTabs` component is rendered below `TripHeader`. The rest of the page conditionally renders either the existing itinerary view or the new `PlacesTab` component.

```
?tab=itinerary  →  existing TripMap + DayFilter + DaySections (unchanged)
?tab=places     →  PlacesTab (new)
```

### New components

| Component | File | Purpose |
|-----------|------|---------|
| `TripTabs` | `src/components/TripTabs.astro` | Tab switcher with "Itinerary" and "Places of Interest" buttons; links to `?tab=...` |
| `PlacesTab` | `src/components/PlacesTab.astro` | Full Places tab content: map + filter bar + card grid + empty state |
| `PlacesMap` | `src/components/PlacesMap.astro` | Leaflet map scoped to POI pins; icons color-coded by category |
| `PlaceCard` | `src/components/PlaceCard.astro` | Single POI card: name, category badge, city, description, address, website + Google Maps links |

### Filter behavior

The city and category filter buttons are rendered server-side but toggled client-side via a small vanilla JS block in `PlacesTab`. No page reload. Map pins update in sync with active filters. If no POIs exist, a simple empty state message is shown.

---

## Admin API Endpoints

Three new endpoints, all requiring `Authorization: Bearer <ADMIN_API_TOKEN>`.

| Method | Path | Action |
|--------|------|--------|
| `POST` | `/api/admin/trips/:id/pois` | Add a POI; server generates nanoid for `id`; returns created POI |
| `PUT` | `/api/admin/trips/:id/pois/:poiId` | Update POI fields (partial); returns updated POI |
| `DELETE` | `/api/admin/trips/:id/pois/:poiId` | Remove POI; returns `{ success: true }` |

All follow the existing read-modify-write-to-KV pattern (`src/lib/kv.ts`). Input validated with Zod at the boundary. Listing POIs is handled by the existing `GET /api/admin/trips/:id` endpoint.

**File locations:**
- `src/pages/api/admin/trips/[id]/pois/index.ts` — handles POST
- `src/pages/api/admin/trips/[id]/pois/[poiId].ts` — handles PUT and DELETE

---

## Claude Skill (`waymark-pois`)

A new skill alongside the existing `waymark-trips` skill for managing POIs conversationally.

**Supported operations:**
- **Add** a POI to a trip — describe the place, skill calls POST endpoint
- **Update** a POI — provide fields to change, skill calls PUT endpoint
- **Remove** a POI — skill calls DELETE endpoint
- **List** POIs for a trip — skill reads via existing `GET /api/admin/trips/:id`

The skill knows the base URL, auth header format, and endpoint shapes. ID generation is handled server-side.

---

## Critical Files

- `src/types/itinerary.ts` — extend schema
- `src/pages/trip/[id].astro` — add tab routing
- `src/lib/kv.ts` — reuse existing helpers (no changes needed)
- `src/components/TripMap.astro` — reference for Leaflet map pattern
- `src/components/TimelineItem.astro` — reference for item component pattern
- `src/pages/api/admin/trips/` — reference for auth + KV endpoint pattern

---

## Verification

1. Add a POI via `POST /api/admin/trips/:id/pois` and confirm it returns the created POI with an `id`
2. Visit `/trip/[id]?tab=places` — Places tab renders with map and card grid
3. City filter buttons appear and filter cards + map pins correctly
4. Category filter buttons work the same way
5. Update and delete a POI via the admin API endpoints
6. Visit `/trip/[id]` (no tab param) — Itinerary tab is default, unchanged behavior
7. Empty state renders when `pois` is empty
8. Existing trips without a `pois` field still load correctly (backward compatibility)
