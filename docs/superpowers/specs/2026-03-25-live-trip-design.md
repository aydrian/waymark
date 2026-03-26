# Live Trip Feature — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Context

The Waymark app currently displays a static itinerary view. There is no concept of "where are we in this trip right now." Travelers using the app during an active trip have no way to jump to today's day or see trip-status-aware UI.

This feature adds a live trip concept: trips are classified as upcoming, live, or completed based on the trip's local timezone date. When a trip is live, travelers get a live banner, a Today filter button, and quick navigation to the current day.

---

## Rules (canonical)

- **Rule A** — Trip is `live` when trip-local date is between `startDate` and `endDate`, inclusive.
- **Rule B** — Current day is the day whose `date` exactly matches the trip-local date.
- **Rule C** — Show the `Today` button only if: status is `live` AND a current day match exists.
- **Rule D** — If `?day=today` is requested but no matching day exists (or trip is not live), render all days.
- **Rule E** — If a numeric `?day=N` is requested but day N does not exist, render all days.
- **Rule F** — Show a visible `Today` badge on the active current day in both navigation and day section header.
- **Rule G** — Feature must work without client-side JavaScript.

---

## Data Model Changes

**File:** `src/types/itinerary.ts`

Add `timezone: z.string()` as a required field on `ItinerarySchema`. This is a breaking change — existing KV trips without `timezone` will fail Zod validation and return `null` from `getTrip()` until re-seeded.

```typescript
export const ItinerarySchema = z.object({
  // ... existing fields ...
  timezone: z.string(), // IANA timezone, e.g. "Europe/Rome"
  // ...
});
```

Derived `Itinerary` TypeScript type picks this up automatically.

---

## New Helper File

**File:** `src/lib/trip-state.ts`

All helpers are pure functions. All accept an optional `now: Date` parameter for testability.

```typescript
getTripLocalDate(timezone: string, now?: Date): string
// Returns current local date in YYYY-MM-DD for the given timezone.
// Uses Intl.DateTimeFormat with en-CA locale (natively emits YYYY-MM-DD).
// No external package required.

getTripStatus(trip: Itinerary, now?: Date): 'upcoming' | 'live' | 'completed'
// Compares trip-local date against startDate/endDate (string comparison, same format).

isLiveTrip(trip: Itinerary, now?: Date): boolean
// Convenience: getTripStatus(...) === 'live'

getCurrentDay(trip: Itinerary, now?: Date): Day | undefined
// Returns the Day whose date === getTripLocalDate(trip.timezone, now).

getCurrentDayNumber(trip: Itinerary, now?: Date): number | undefined
// Returns getCurrentDay(...)?.dayNumber

getVisibleDays(trip: Itinerary, dayParam: string | null, now?: Date): {
  days: Day[];
  filter: 'all' | 'today' | number;
}
// Resolves the ?day= query param to a concrete list of days and an active filter label.
// Resolution rules:
//   null or empty         → { days: all, filter: 'all' }
//   'today', live, match  → { days: [currentDay], filter: 'today' }
//   'today', else         → { days: all, filter: 'all' }     (Rule D)
//   numeric, exists       → { days: [matchedDay], filter: N }
//   numeric, not found    → { days: all, filter: 'all' }     (Rule E)
//   non-numeric string    → { days: all, filter: 'all' }
```

---

## Route Changes

**File:** `src/pages/trip/[id].astro`

Replace the current manual day-filter logic with helper calls. Compute all derived state at the top of the frontmatter:

```typescript
const dayParam = Astro.url.searchParams.get('day');
const { days: visibleDays, filter: activeFilter } = getVisibleDays(trip, dayParam);
const tripStatus = getTripStatus(trip);
const currentDay = getCurrentDay(trip);
const currentDayNumber = currentDay?.dayNumber;
const isLive = tripStatus === 'live';

const mapItems = visibleDays.flatMap(d => d.items);
```

Pass new props to components:
- `<LiveTripBanner>` — rendered above `<TripHeader>` when `isLive`
- `<DayFilter>` — updated props (see below)
- `<DaySection>` — add `isToday={day.dayNumber === currentDayNumber}`

Add prev/next day navigation when viewing a single day (nice-to-have). Computed in route, rendered as a simple `<nav>` below the `<DaySection>` in the route template:
```typescript
const singleDay = typeof activeFilter === 'number' ? activeFilter : null;
const prevDayNumber = singleDay ? trip.days.find(d => d.dayNumber === singleDay - 1)?.dayNumber : undefined;
const nextDayNumber = singleDay ? trip.days.find(d => d.dayNumber === singleDay + 1)?.dayNumber : undefined;
```
Rendered inline in `[id].astro` (not a separate component) as `← Day N` / `Day N →` links below the day content.

---

## Component Changes

### `DayFilter.astro` (updated)

**New props:**
```typescript
interface Props {
  days: Day[];                            // replaces totalDays: number
  activeFilter: 'all' | 'today' | number;
  tripId: string;
  isLive: boolean;
  currentDayNumber?: number;
}
```

**Behavior:**
- Render `All days` pill — active when `activeFilter === 'all'`
- Render `Today` pill — only when `isLive && currentDayNumber !== undefined` (Rule C); active when `activeFilter === 'today'`
- Render `Day N` pill for each day — active when `activeFilter === N`; show `Today` inline badge on `currentDayNumber` (Rule F)
- `aria-current="page"` on active pill
- Horizontally scrollable on mobile (`overflow-x-auto`, `min-w-max` inner div)

### `DaySection.astro` (updated)

**New prop:** `isToday?: boolean`

When `isToday` is true, render a `<CurrentDayBadge />` next to the day header.

### `LiveTripBanner.astro` (new)

**Props:**
```typescript
interface Props {
  currentDayNumber: number;
  totalDays: number;
  localDate: string;       // formatted display string, e.g. "Wed, Mar 25" — computed in route via Intl.DateTimeFormat
  tripId: string;
}
```

**Renders:**
- `You're on Day 4 of 7`
- Local trip date: `Wed, Mar 25`
- `Jump to today` link → `/trip/{id}?day=today`
- Compact, dismissible-looking (but static, no JS) amber/yellow banner

### `CurrentDayBadge.astro` (new)

Tiny green `Today` badge. No props — purely presentational. Used in both `DayFilter` and `DaySection`.

---

## Seed Data Changes

**File:** `scripts/seed.ts`

Update "Amalfi Coast & Rome" trip:
- Add `timezone: "Europe/Rome"`
- Shift dates to `startDate: "2026-03-22"`, `endDate: "2026-03-28"` — making **today (2026-03-25) = Day 4** (live)
- Expand from 5 to 7 days to cover the full range
- Days 6–7 cover the Rome portion of the trip (currently cut off)

Optionally add a second seed object for an upcoming trip (future dates) for manual testing of non-live state. Exported via a named export or as a second `console.log` call so it's easy to pipe separately.

---

## Tests

**File:** `src/lib/trip-state.test.ts`

Uses bun's built-in test runner — no new dependency. Add `"test": "bun test"` to `package.json` scripts.

Test cases:
- `getTripLocalDate` — injects fixed `now`, asserts YYYY-MM-DD in correct timezone
- `getTripStatus` — upcoming / live / completed with controlled dates
- `getCurrentDay` — match found / no match (weekend gap in itinerary)
- `getVisibleDays` — all resolution paths: null, 'today' (live+match), 'today' (not live), 'today' (live, no match), numeric found, numeric not found, invalid string
- Timezone boundary: same UTC moment, different local dates across timezone boundary

---

## Verification Steps

1. `bun test` — all helper unit tests pass
2. Re-seed KV with updated seed data: `bun scripts/seed.ts > /tmp/trip.json && wrangler kv key put --binding=TRIPS --local "trip:a8k3m2q9" --path /tmp/trip.json`
3. `bun dev` — navigate to `/trip/a8k3m2q9` (after PIN entry)
4. Verify live banner shows "You're on Day 4 of 7" with correct local date
5. Verify `Today` button appears in DayFilter
6. Click `Today` → URL becomes `?day=today` → only Day 4 shown with Today badge
7. Click `Day 2` → only Day 2 shown, no Today badge
8. Navigate to `?day=99` → falls back to all days (Rule E)
9. Navigate to `?day=today` while trip is not live (change seed dates to past) → all days shown (Rule D)
10. Verify no JS required: disable JS in browser, confirm filter links still work via full page navigations

---

## Files Changed / Created

| Action | Path |
|--------|------|
| Modified | `src/types/itinerary.ts` |
| Created | `src/lib/trip-state.ts` |
| Modified | `src/pages/trip/[id].astro` |
| Modified | `src/components/DayFilter.astro` |
| Modified | `src/components/DaySection.astro` |
| Created | `src/components/LiveTripBanner.astro` |
| Created | `src/components/CurrentDayBadge.astro` |
| Modified | `scripts/seed.ts` |
| Created | `src/lib/trip-state.test.ts` |
| Modified | `package.json` (add `test` script) |
