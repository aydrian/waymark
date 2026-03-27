# Places of Interest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Places of Interest" tab to each trip page showing a filterable, map-backed list of recommended places that aren't yet in the itinerary.

**Architecture:** POIs are stored as a `pois` array on the `Itinerary` document in KV (same pattern as `stays`). The trip page gains a tab switcher (`?tab=itinerary` vs `?tab=places`); the Places tab renders a Leaflet map and card grid with client-side city/category filtering. Three new admin API endpoints handle CRUD, and a `waymark-pois` skill wraps them.

**Tech Stack:** Astro SSR, Cloudflare Workers + KV, Zod v4, Leaflet, Tailwind CSS v4, Bun test runner

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/types/itinerary.ts` | Add `PoiCategorySchema`, `PlaceOfInterestSchema`; extend `ItinerarySchema` |
| Create | `src/pages/api/admin/trips/[id]/pois/index.ts` | POST — add a POI |
| Create | `src/pages/api/admin/trips/[id]/pois/[poiId].ts` | PUT / DELETE — update or remove a POI |
| Create | `src/components/TripTabs.astro` | Tab switcher (Itinerary / Places of Interest) |
| Create | `src/components/PlaceCard.astro` | Single POI card |
| Create | `src/components/PlacesMap.astro` | Leaflet map for POI pins |
| Create | `src/components/PlacesTab.astro` | Full Places tab (map + filters + grid) |
| Modify | `src/pages/trip/[id].astro` | Read `?tab`, render `TripTabs`, conditionally render `PlacesTab` |
| Create | `waymark-pois/SKILL.md` | Claude skill for POI management |
| Create | `src/types/itinerary.test.ts` | Schema tests for new POI types |

---

## Task 1: Extend the Itinerary schema

**Files:**
- Modify: `src/types/itinerary.ts`
- Create: `src/types/itinerary.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `src/types/itinerary.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { PoiCategorySchema, PlaceOfInterestSchema, ItinerarySchema } from './itinerary';

describe('PoiCategorySchema', () => {
  it('accepts all valid categories', () => {
    const valid = ['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other'];
    valid.forEach(cat => {
      expect(PoiCategorySchema.safeParse(cat).success).toBe(true);
    });
  });

  it('rejects unknown category', () => {
    expect(PoiCategorySchema.safeParse('museum').success).toBe(false);
  });
});

describe('PlaceOfInterestSchema', () => {
  it('accepts a minimal valid POI', () => {
    const result = PlaceOfInterestSchema.safeParse({
      id: 'abc123',
      name: 'Café de Flore',
      category: 'restaurant',
      city: 'Paris',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated POI', () => {
    const result = PlaceOfInterestSchema.safeParse({
      id: 'abc123',
      name: 'Café de Flore',
      category: 'restaurant',
      city: 'Paris',
      address: '172 Bd Saint-Germain, 75006 Paris',
      lat: 48.854,
      lng: 2.333,
      website: 'https://cafedeflore.fr',
      googleMapsUrl: 'https://maps.google.com/?q=Caf%C3%A9+de+Flore',
      description: 'Historic café on the Left Bank.',
      advisorNotes: 'Go for breakfast — less crowded.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid website URL', () => {
    const result = PlaceOfInterestSchema.safeParse({
      id: 'abc123',
      name: 'Test',
      category: 'shop',
      city: 'Lyon',
      website: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('requires name, category, and city', () => {
    const result = PlaceOfInterestSchema.safeParse({ id: 'abc123' });
    expect(result.success).toBe(false);
  });
});

describe('ItinerarySchema pois field', () => {
  const minimalTrip = {
    id: 'a8k3m2q9',
    title: 'Test Trip',
    startDate: '2026-03-22',
    endDate: '2026-03-28',
    timezone: 'Europe/Paris',
    destinations: ['Paris'],
    days: [],
    pinSalt: 'deadbeefcafebabedeadbeefcafebabe',
    pinHash: '643bf561dd676254c08d60701376ce3e9e638b80210a3f1c3ae0cee0c0ca0ccd',
    updatedAt: '2026-03-27T12:00:00Z',
  };

  it('defaults pois to empty array when omitted', () => {
    const result = ItinerarySchema.safeParse(minimalTrip);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pois).toEqual([]);
  });

  it('accepts a trip with pois', () => {
    const result = ItinerarySchema.safeParse({
      ...minimalTrip,
      pois: [{ id: 'p1', name: 'Eiffel Tower', category: 'attraction', city: 'Paris' }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pois).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/types/itinerary.test.ts
```

Expected: errors like `PoiCategorySchema is not exported` — confirms the tests are wired correctly.

- [ ] **Step 3: Add schemas to `src/types/itinerary.ts`**

Add the following after the `HotelStaySchema` block (before `TripItemSchema`):

```typescript
export const PoiCategorySchema = z.enum([
  'restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other',
]);

export const PlaceOfInterestSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: PoiCategorySchema,
  city: z.string(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  website: z.string().url().optional(),
  googleMapsUrl: z.string().url().optional(),
  description: z.string().optional(),
  advisorNotes: z.string().optional(),
});
```

Add `pois` to `ItinerarySchema` after the `stays` line:

```typescript
  stays: z.array(HotelStaySchema).optional(),
  pois: z.array(PlaceOfInterestSchema).optional().default([]),
```

Add TypeScript type exports after the existing type exports:

```typescript
export type PoiCategory = z.infer<typeof PoiCategorySchema>;
export type PlaceOfInterest = z.infer<typeof PlaceOfInterestSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/types/itinerary.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/itinerary.ts src/types/itinerary.test.ts
git commit -m "feat(types): add PlaceOfInterest schema to Itinerary"
```

---

## Task 2: POST /api/admin/trips/:id/pois

**Files:**
- Create: `src/pages/api/admin/trips/[id]/pois/index.ts`

- [ ] **Step 1: Create the file**

Create `src/pages/api/admin/trips/[id]/pois/index.ts`:

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAuth } from '../../../../../../lib/auth';
import { getTrip, putTrip } from '../../../../../../lib/kv';
import { PlaceOfInterestSchema } from '../../../../../../types/itinerary';

const CreatePoiSchema = PlaceOfInterestSchema.omit({ id: true });

export const POST: APIRoute = async ({ params, request }) => {
  const authError = requireAdminAuth(request, env.ADMIN_API_TOKEN);
  if (authError) return authError;

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, id);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = CreatePoiSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const poi = { ...result.data, id: crypto.randomUUID() };
  const updatedTrip = {
    ...trip,
    pois: [...trip.pois, poi],
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(poi), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Smoke test with dev server**

Start the dev server and run:

```bash
bun run dev
# In another terminal:
curl -s -X POST \
  -H "Authorization: Bearer $(grep ADMIN_API_TOKEN .dev.vars | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"name":"Eiffel Tower","category":"attraction","city":"Paris"}' \
  http://localhost:4321/api/admin/trips/YOUR_TRIP_ID/pois | jq .
```

Expected: `{"id":"<uuid>","name":"Eiffel Tower","category":"attraction","city":"Paris"}`

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/trips/[id]/pois/index.ts
git commit -m "feat(api): add POST /api/admin/trips/:id/pois endpoint"
```

---

## Task 3: PUT and DELETE /api/admin/trips/:id/pois/:poiId

**Files:**
- Create: `src/pages/api/admin/trips/[id]/pois/[poiId].ts`

- [ ] **Step 1: Create the file**

Create `src/pages/api/admin/trips/[id]/pois/[poiId].ts`:

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAuth } from '../../../../../../lib/auth';
import { getTrip, putTrip } from '../../../../../../lib/kv';
import { PlaceOfInterestSchema } from '../../../../../../types/itinerary';

const UpdatePoiSchema = PlaceOfInterestSchema.omit({ id: true }).partial();

export const PUT: APIRoute = async ({ params, request }) => {
  const authError = requireAdminAuth(request, env.ADMIN_API_TOKEN);
  if (authError) return authError;

  const { id, poiId } = params as { id: string; poiId: string };
  if (!id || !poiId) {
    return new Response(JSON.stringify({ error: 'Missing id or poiId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, id);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = trip.pois.find(p => p.id === poiId);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = UpdatePoiSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = { ...existing, ...result.data };
  const updatedTrip = {
    ...trip,
    pois: trip.pois.map(p => p.id === poiId ? updated : p),
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const authError = requireAdminAuth(request, env.ADMIN_API_TOKEN);
  if (authError) return authError;

  const { id, poiId } = params as { id: string; poiId: string };
  if (!id || !poiId) {
    return new Response(JSON.stringify({ error: 'Missing id or poiId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, id);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const exists = trip.pois.some(p => p.id === poiId);
  if (!exists) {
    return new Response(JSON.stringify({ error: 'POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedTrip = {
    ...trip,
    pois: trip.pois.filter(p => p.id !== poiId),
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Smoke test PUT and DELETE**

```bash
# Replace POI_ID with the UUID returned from Task 2
curl -s -X PUT \
  -H "Authorization: Bearer $(grep ADMIN_API_TOKEN .dev.vars | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"description":"The iconic iron tower.","lat":48.8584,"lng":2.2945}' \
  http://localhost:4321/api/admin/trips/YOUR_TRIP_ID/pois/POI_ID | jq .

curl -s -X DELETE \
  -H "Authorization: Bearer $(grep ADMIN_API_TOKEN .dev.vars | cut -d= -f2)" \
  http://localhost:4321/api/admin/trips/YOUR_TRIP_ID/pois/POI_ID | jq .
```

Expected: PUT returns the merged POI; DELETE returns `{"success":true}`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/trips/[id]/pois/[poiId].ts
git commit -m "feat(api): add PUT and DELETE /api/admin/trips/:id/pois/:poiId endpoints"
```

---

## Task 4: TripTabs component

**Files:**
- Create: `src/components/TripTabs.astro`

- [ ] **Step 1: Create the file**

Create `src/components/TripTabs.astro`:

```astro
---
interface Props {
  tripId: string;
  activeTab: 'itinerary' | 'places';
  poisCount: number;
}
const { tripId, activeTab, poisCount } = Astro.props;
---
<nav aria-label="Trip sections" class="border-b border-[var(--color-border)]">
  <div class="flex px-4 sm:px-6">
    <a
      href={`/trip/${tripId}`}
      aria-current={activeTab === 'itinerary' ? 'page' : undefined}
      class={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
        activeTab === 'itinerary'
          ? 'border-[var(--color-text-primary)] text-[var(--color-text-primary)]'
          : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      }`}
    >Itinerary</a>
    <a
      href={`/trip/${tripId}?tab=places`}
      aria-current={activeTab === 'places' ? 'page' : undefined}
      class={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] ${
        activeTab === 'places'
          ? 'border-[var(--color-text-primary)] text-[var(--color-text-primary)]'
          : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      Places of Interest
      {poisCount > 0 && (
        <span class="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
          {poisCount}
        </span>
      )}
    </a>
  </div>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TripTabs.astro
git commit -m "feat(components): add TripTabs tab switcher component"
```

---

## Task 5: PlaceCard component

**Files:**
- Create: `src/components/PlaceCard.astro`

- [ ] **Step 1: Create the file**

Create `src/components/PlaceCard.astro`:

```astro
---
import type { PlaceOfInterest } from '../types/itinerary';

interface Props {
  poi: PlaceOfInterest;
}
const { poi } = Astro.props;

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  attraction: 'Attraction',
  shop: 'Shop',
  outdoor: 'Outdoor',
  entertainment: 'Entertainment',
  other: 'Other',
};

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  attraction: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  shop: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  outdoor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  entertainment: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
---
<div
  class="poi-card rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
  data-city={poi.city}
  data-category={poi.category}
>
  <div class="flex items-start justify-between gap-2">
    <h3 class="font-semibold text-[var(--color-text-primary)]">{poi.name}</h3>
    <span class={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[poi.category] ?? CATEGORY_COLORS.other}`}>
      {CATEGORY_LABELS[poi.category] ?? poi.category}
    </span>
  </div>

  <p class="mt-0.5 text-xs text-[var(--color-text-muted)]">{poi.city}</p>

  {poi.description && (
    <p class="mt-2 text-sm text-[var(--color-text-secondary)]">{poi.description}</p>
  )}

  {poi.advisorNotes && (
    <p class="mt-2 rounded-lg bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)] italic">
      {poi.advisorNotes}
    </p>
  )}

  {poi.address && (
    <p class="mt-2 text-xs text-[var(--color-text-muted)]">{poi.address}</p>
  )}

  {(poi.website || poi.googleMapsUrl) && (
    <div class="mt-3 flex flex-wrap gap-3">
      {poi.website && (
        <a
          href={poi.website}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[var(--color-text-secondary)] underline hover:text-[var(--color-text-primary)]"
        >Website ↗</a>
      )}
      {poi.googleMapsUrl && (
        <a
          href={poi.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[var(--color-text-secondary)] underline hover:text-[var(--color-text-primary)]"
        >Google Maps ↗</a>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PlaceCard.astro
git commit -m "feat(components): add PlaceCard component"
```

---

## Task 6: PlacesMap component

**Files:**
- Create: `src/components/PlacesMap.astro`

- [ ] **Step 1: Create the file**

Create `src/components/PlacesMap.astro`:

```astro
---
import type { PlaceOfInterest } from '../types/itinerary';
import 'leaflet/dist/leaflet.css';

interface Props {
  pois: PlaceOfInterest[];
}
const { pois } = Astro.props;
const coordPois = pois.filter(p => p.lat !== undefined && p.lng !== undefined);

const mapData = JSON.stringify({
  pois: coordPois.map(p => ({
    lat: p.lat,
    lng: p.lng,
    name: p.name,
    category: p.category,
    city: p.city,
    address: p.address,
  })),
});
---
{coordPois.length > 0 && (
  <div class="px-4 pt-4 sm:px-6">
    <div
      id="places-map"
      class="rounded-xl overflow-hidden border border-[var(--color-border)] h-52"
      data-map={mapData}
    ></div>
  </div>
)}

<script>
  import L from 'leaflet';

  const el = document.getElementById('places-map') as HTMLElement | null;
  if (el) {
    const { pois } = JSON.parse(el.dataset.map!) as {
      pois: { lat: number; lng: number; name: string; category: string; city: string; address?: string }[];
    };
    const isDark = document.documentElement.classList.contains('dark');
    const markerBorder = isDark ? '#44403c' : '#ffffff';

    const CATEGORY_COLORS: Record<string, string> = {
      restaurant: '#f97316',
      attraction: '#22c55e',
      shop: '#a855f7',
      outdoor: '#14b8a6',
      entertainment: '#ec4899',
      other: '#6b7280',
    };

    const map = L.map(el, { zoomControl: true, scrollWheelZoom: false });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const markers: L.Marker[] = [];
    for (const poi of pois) {
      const color = CATEGORY_COLORS[poi.category] ?? '#6b7280';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid ${markerBorder};box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([poi.lat, poi.lng], { icon });
      const detail = poi.address ?? poi.city;
      marker.bindPopup(`<strong>${poi.name}</strong>${detail ? `<br><span style="font-size:0.75rem">${detail}</span>` : ''}`);
      marker.addTo(map);
      markers.push(marker);
    }

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }

    // React to filter changes dispatched by PlacesTab
    window.addEventListener('poi-filter-change', (e: Event) => {
      const { cities, categories } = (e as CustomEvent<{ cities: string[]; categories: string[] }>).detail;
      markers.forEach((marker, i) => {
        const poi = pois[i];
        const cityMatch = cities.length === 0 || cities.includes(poi.city);
        const catMatch = categories.length === 0 || categories.includes(poi.category);
        if (cityMatch && catMatch) {
          marker.addTo(map);
        } else {
          marker.remove();
        }
      });
    });
  }
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PlacesMap.astro
git commit -m "feat(components): add PlacesMap Leaflet component for POI pins"
```

---

## Task 7: PlacesTab component

**Files:**
- Create: `src/components/PlacesTab.astro`

- [ ] **Step 1: Create the file**

Create `src/components/PlacesTab.astro`:

```astro
---
import type { PlaceOfInterest } from '../types/itinerary';
import PlacesMap from './PlacesMap.astro';
import PlaceCard from './PlaceCard.astro';

interface Props {
  pois: PlaceOfInterest[];
}
const { pois } = Astro.props;

const cities = [...new Set(pois.map(p => p.city))].sort();
const categories = [...new Set(pois.map(p => p.category))].sort();
---
{pois.length === 0 ? (
  <div class="px-4 py-12 text-center">
    <p class="text-sm text-[var(--color-text-muted)]">No places of interest yet.</p>
  </div>
) : (
  <div>
    <PlacesMap pois={pois} />

    {/* Filter bar — only shown when there's something to filter */}
    {(cities.length > 1 || categories.length > 1) && (
      <div class="px-4 pt-4 sm:px-6 space-y-2">
        {cities.length > 1 && (
          <div class="flex flex-wrap gap-1.5">
            {cities.map(city => (
              <button
                type="button"
                data-filter="city"
                data-value={city}
                class="filter-btn rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
              >{city}</button>
            ))}
          </div>
        )}
        {categories.length > 1 && (
          <div class="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                type="button"
                data-filter="category"
                data-value={cat}
                class="filter-btn rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] capitalize hover:bg-[var(--color-bg-subtle)] transition-colors"
              >{cat}</button>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Card grid */}
    <div id="poi-grid" class="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6">
      {pois.map(poi => (
        <PlaceCard poi={poi} />
      ))}
    </div>
  </div>
)}

<script>
  const activeCities = new Set<string>();
  const activeCategories = new Set<string>();

  function applyFilters() {
    const cards = document.querySelectorAll<HTMLElement>('.poi-card');
    cards.forEach(card => {
      const city = card.dataset.city ?? '';
      const category = card.dataset.category ?? '';
      const cityMatch = activeCities.size === 0 || activeCities.has(city);
      const catMatch = activeCategories.size === 0 || activeCategories.has(category);
      card.style.display = cityMatch && catMatch ? '' : 'none';
    });

    window.dispatchEvent(new CustomEvent('poi-filter-change', {
      detail: {
        cities: [...activeCities],
        categories: [...activeCategories],
      },
    }));
  }

  function setButtonActive(btn: HTMLElement, active: boolean) {
    if (active) {
      btn.classList.add('bg-[var(--color-btn-active-bg)]', 'text-[var(--color-btn-active-text)]');
      btn.classList.remove('border-[var(--color-border)]', 'text-[var(--color-text-secondary)]');
    } else {
      btn.classList.remove('bg-[var(--color-btn-active-bg)]', 'text-[var(--color-btn-active-text)]');
      btn.classList.add('border-[var(--color-border)]', 'text-[var(--color-text-secondary)]');
    }
  }

  document.querySelectorAll<HTMLElement>('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.filter!;
      const value = btn.dataset.value!;
      const set = type === 'city' ? activeCities : activeCategories;

      if (set.has(value)) {
        set.delete(value);
        setButtonActive(btn, false);
      } else {
        set.add(value);
        setButtonActive(btn, true);
      }

      applyFilters();
    });
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PlacesTab.astro
git commit -m "feat(components): add PlacesTab with filterable card grid and map"
```

---

## Task 8: Wire tabs into the trip page

**Files:**
- Modify: `src/pages/trip/[id].astro`

- [ ] **Step 1: Add imports**

In the frontmatter of `src/pages/trip/[id].astro`, add two imports after the existing component imports:

```typescript
import TripTabs from '../../components/TripTabs.astro';
import PlacesTab from '../../components/PlacesTab.astro';
```

- [ ] **Step 2: Read the tab query param**

After the `// 3. Compute trip state` block, add:

```typescript
// 4. Tab state
const tabParam = Astro.url.searchParams.get('tab');
const activeTab = tabParam === 'places' ? 'places' : 'itinerary';
const pois = trip.pois;
```

Renumber the existing steps 4–7 to 5–8 in the comments.

- [ ] **Step 3: Update the template**

In the template, replace:

```astro
      <TripHeader trip={trip} />
      <TripMap
```

with:

```astro
      <TripHeader trip={trip} />
      <TripTabs tripId={id} activeTab={activeTab} poisCount={pois.length} />
      {activeTab === 'places' ? (
        <PlacesTab pois={pois} />
      ) : (
        <>
      <TripMap
```

Then close the `<>` fragment by adding `</>` right before the closing `</main>` tag, so that the entire itinerary content (TripMap through the prev/next nav) is wrapped in the fragment.

The resulting structure should look like:

```astro
      <TripHeader trip={trip} />
      <TripTabs tripId={id} activeTab={activeTab} poisCount={pois.length} />
      {activeTab === 'places' ? (
        <PlacesTab pois={pois} />
      ) : (
        <>
          <TripMap ... />
          <DayFilter ... />
          <div class="py-4">
            ...day sections...
          </div>
          {/* prev/next nav */}
          {singleDay !== null && (...)}
        </>
      )}
```

- [ ] **Step 4: Verify in browser**

Visit `/trip/YOUR_ID` — confirm the Itinerary tab is active and itinerary renders as before.
Visit `/trip/YOUR_ID?tab=places` — confirm the Places tab is active and shows POI content (or empty state if no POIs).

- [ ] **Step 5: Commit**

```bash
git add src/pages/trip/[id].astro
git commit -m "feat(trip): add Places of Interest tab to trip page"
```

---

## Task 9: waymark-pois skill

**Files:**
- Create: `waymark-pois/SKILL.md`

- [ ] **Step 1: Create the skill directory and file**

Create `waymark-pois/SKILL.md`:

```markdown
---
name: waymark-pois
description: Add, update, remove, and list Places of Interest (POIs) on Waymark trips. Use whenever the user wants to add a recommendation, attraction, restaurant, shop, or any place of interest to a Waymark trip — even phrased as "add a place", "add a recommendation", "remove that spot", or "what POIs are on trip X".
---

# Waymark POI Manager

A skill for managing Places of Interest on Waymark trips via its admin API.

Announce at the start: "I'm using the waymark-pois skill to handle this."

---

## Step 1: Resolve Configuration

| Variable | How to find it |
|---|---|
| `WAYMARK_BASE_URL` | Check `$WAYMARK_BASE_URL` env var → default to `https://waymark.itsaydrian.com` |
| `WAYMARK_ADMIN_TOKEN` | Check `$WAYMARK_ADMIN_TOKEN` env var → check `.dev.vars` in cwd → ask the user |

If both are set in the environment, proceed silently. Never echo the token in output.

```bash
grep ADMIN_API_TOKEN .dev.vars 2>/dev/null | cut -d= -f2
```

---

## Step 2: Determine the Operation

| User intent | Operation |
|---|---|
| "add a place", "recommend X", "add POI" | [Add POI](#add-a-poi) |
| "update", "edit", "change", "add the website for" | [Update POI](#update-a-poi) |
| "remove", "delete", "take out" | [Remove POI](#remove-a-poi) |
| "list", "show", "what POIs", "what places" | [List POIs](#list-pois) |

If the user hasn't specified a trip ID, ask for it before proceeding.

---

## POI Fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Display name of the place |
| `category` | yes | One of: `restaurant`, `attraction`, `shop`, `outdoor`, `entertainment`, `other` |
| `city` | yes | Free-form city name — used for the city filter |
| `address` | no | Street address |
| `lat` | no | Decimal latitude — enables map pin |
| `lng` | no | Decimal longitude — enables map pin |
| `website` | no | Full URL including `https://` |
| `googleMapsUrl` | no | Full Google Maps URL |
| `description` | no | Short description of the place |
| `advisorNotes` | no | Travel advisor recommendation or tip |

If the user provides a place name and city, you can infer `lat`/`lng` from your own knowledge. Always confirm with the user before submitting coordinates.

---

## Add a POI

Gather the required fields (`name`, `category`, `city`) plus any optional fields the user provides.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PLACE_NAME",
    "category": "CATEGORY",
    "city": "CITY"
  }' \
  "$BASE_URL/api/admin/trips/TRIP_ID/pois"
```

On `201`: show the user the POI was added and display the trip URL.
On `422`: surface the `issues` array in plain language.

---

## Update a POI

First list POIs to find the POI ID (see [List POIs](#list-pois)).

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"FIELD": "NEW_VALUE"}' \
  "$BASE_URL/api/admin/trips/TRIP_ID/pois/POI_ID"
```

Only include fields being changed. On `200`: confirm which fields were updated.

---

## Remove a POI

First list POIs to confirm the POI ID with the user.

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips/TRIP_ID/pois/POI_ID"
```

On `200 {"success":true}`: confirm removal to the user.

---

## List POIs

Uses the existing trip fetch endpoint:

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips/TRIP_ID"
```

Extract and display the `pois` array in a readable table: name, category, city, ID.

---

## After Any Write

Always show the trip URL: `$BASE_URL/trip/TRIP_ID`

---

## Error Handling

| HTTP Status | Meaning | Action |
|---|---|---|
| 401 | Bad or missing token | Verify `WAYMARK_ADMIN_TOKEN` |
| 400 | Malformed JSON | Check syntax before retrying |
| 404 | Trip or POI not found | Confirm IDs with user |
| 422 | Validation failed | Surface `issues[].message` in plain language |
```

- [ ] **Step 2: Commit**

```bash
git add waymark-pois/SKILL.md
git commit -m "feat(skill): add waymark-pois skill for POI management"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Run the full test suite**

```bash
bun test
```

Expected: all tests pass including the new schema tests in `src/types/itinerary.test.ts`.

- [ ] **Step 2: Add a real POI via the API and verify the Places tab**

```bash
# Add a POI with coordinates
curl -s -X POST \
  -H "Authorization: Bearer $(grep ADMIN_API_TOKEN .dev.vars | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Eiffel Tower",
    "category": "attraction",
    "city": "Paris",
    "lat": 48.8584,
    "lng": 2.2945,
    "description": "The iconic iron tower.",
    "googleMapsUrl": "https://maps.google.com/?q=Eiffel+Tower"
  }' \
  http://localhost:4321/api/admin/trips/YOUR_TRIP_ID/pois | jq .
```

Visit `http://localhost:4321/trip/YOUR_TRIP_ID?tab=places` and confirm:
- Places tab is highlighted
- Map renders with a green pin at the Eiffel Tower location
- Card shows name, category badge, city, description, and Google Maps link

- [ ] **Step 3: Verify backward compatibility**

Visit a trip that has no `pois` field in its stored KV data:
- Confirm it loads without errors
- Confirm the Places tab shows the empty state message

- [ ] **Step 4: Verify the Itinerary tab is unchanged**

Visit `http://localhost:4321/trip/YOUR_TRIP_ID` (no `?tab` param):
- Itinerary tab is highlighted
- Map, day filter, and timeline all render normally

- [ ] **Step 5: Test city and category filters (if multiple POIs exist)**

Add a second POI in a different city and category:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $(grep ADMIN_API_TOKEN .dev.vars | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"name":"Le Marais Falafel","category":"restaurant","city":"Paris","address":"34 Rue des Rosiers"}' \
  http://localhost:4321/api/admin/trips/YOUR_TRIP_ID/pois | jq .

curl -s -X POST \
  -H "Authorization: Bearer $(grep ADMIN_API_TOKEN .dev.vars | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"name":"Shakespeare and Company","category":"shop","city":"Paris","address":"37 Rue de la Bûcherie"}' \
  http://localhost:4321/api/admin/trips/YOUR_TRIP_ID/pois | jq .
```

Visit `?tab=places` and confirm:
- Category filter buttons appear (attraction, restaurant, shop)
- Clicking "restaurant" hides the other cards
- Clicking "restaurant" again deselects and shows all cards
