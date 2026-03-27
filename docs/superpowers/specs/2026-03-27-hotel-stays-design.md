# Hotel Stays — Design Spec

**Date:** 2026-03-27
**Status:** Approved

---

## Problem

Hotel stays are currently stored as `TripItem` objects (`type: 'hotel'`) spread across individual days — a check-in item on one day and a separate checkout item on another, with no explicit link between them and no stored date range. Determining which hotel a traveler is staying at on any given night requires heuristic scanning across days, and intermediate nights (where neither event occurs) have no hotel data at all.

---

## Solution

Move hotel stays to a dedicated top-level `stays: HotelStay[]` array on the `Itinerary`. Each `HotelStay` explicitly stores `checkinDate`, `checkinTime`, `checkoutDate`, and `checkoutTime` plus all hotel details. Hotel `TripItem` entries are removed from `day.items` in stored data; check-in and checkout timeline items are generated at render time from `stays`.

---

## Schema Changes

### New `HotelStaySchema`

```typescript
HotelStaySchema = z.object({
  id: z.string(),
  title: z.string(),                    // hotel display name, e.g. "Le Sirenuse"
  status: ItemStatusSchema,             // booked | quoted | pending | canceled
  checkinDate: z.string(),              // YYYY-MM-DD
  checkinTime: z.string().optional(),   // HH:MM (24-hour)
  checkoutDate: z.string(),             // YYYY-MM-DD
  checkoutTime: z.string().optional(),  // HH:MM (24-hour)
  location: z.string().optional(),      // venue/area name
  address: z.string().optional(),       // full street address
  lat: z.number().optional(),           // WGS84 (for map pin)
  lng: z.number().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});
```

### Updated `ItinerarySchema`

Add `stays: z.array(HotelStaySchema).optional()` at the top level. Optional for backward compatibility with existing trips that have no stays.

### `ItemTypeSchema`

Keep `'hotel'` in the enum — it is used for the generated timeline items at render time.

---

## Utility Functions (`src/lib/trip-state.ts`)

### `getActiveStayForNight(stays, date): HotelStay | null`

Returns the stay the traveler is sleeping at on the night of `date`.

**Rule:** a stay is active for a given night if `stay.checkinDate <= date < stay.checkoutDate`.

This correctly handles all cases:
- Check-in day: `checkinDate == date` satisfies `<=`
- Intermediate days: date falls within range
- Checkout day: `checkoutDate == date` fails `<`, so no active stay
- Checkout + new check-in: the new stay's `checkinDate == date` satisfies `<=`

### `generateHotelTimelineItems(stays, date): TripItem[]`

Returns generated `TripItem` objects for check-in and/or checkout events on `date`.

- For each stay where `stay.checkinDate == date`: emit a check-in item with full hotel details
- For each stay where `stay.checkoutDate == date`: emit a checkout item with only `startTime`

Generated item IDs use the pattern `stay-{stay.id}-checkin` / `stay-{stay.id}-checkout`.

---

## Day View Changes

### Hotel Stay Banner (`src/components/HotelStayBanner.astro`)

New component rendered at the top of each day section (above the timeline), displaying tonight's accommodation context.

**Props:** `activeStay: HotelStay | null`, `checkinToday: HotelStay | null`, `checkoutToday: HotelStay | null`

**Display rules:**

| Scenario | Banner content |
|---|---|
| Check-in day (active stay = tonight's hotel) | Hotel name + address + "Check-in HH:MM · Conf: X" |
| Intermediate stay day | Hotel name + "Staying tonight" |
| Checkout + check-in same day | Checkout row ("Checking out · Hotel A at HH:MM") + check-in row (full details) |
| Checkout-only day (departure) | "Checking out · Hotel Name at HH:MM" |
| No stay, no checkout | Banner not rendered |

### `DaySection.astro` changes

Add optional props:
- `activeStay: HotelStay | null`
- `checkinToday: HotelStay | null`
- `checkoutToday: HotelStay | null`
- `generatedItems: TripItem[]`

Render `HotelStayBanner` above the timeline when any hotel data is present.

Merge `generatedItems` with `day.items` when rendering timeline, sorted by `startTime` (items without a time sort to the end).

### `[id].astro` changes

After computing `visibleDays`, for each day compute:
- `activeStay` via `getActiveStayForNight(trip.stays ?? [], day.date)`
- `checkinToday` — stay where `checkinDate == day.date`
- `checkoutToday` — stay where `checkoutDate == day.date`
- `generatedItems` via `generateHotelTimelineItems(trip.stays ?? [], day.date)`

Also include hotel locations in `mapItems` by generating hotel TripItems from all stays (using checkinDate items only, to avoid duplicating pins).

---

## Map Pins

Hotel locations (from `stays`) are currently contributed to the map via their `lat`/`lng`. Since hotel items are removed from `day.items`, the map must source hotel pins separately. In `[id].astro`, generate map-pin items from `stays` filtered to visible days (by `checkinDate`) and merge them into `mapItems`.

---

## Seed Data Changes (`scripts/seed.ts`)

Remove all `type: 'hotel'` items from `day.items`. Add a top-level `stays` array with:

| Stay | checkinDate | checkoutDate |
|---|---|---|
| Le Sirenuse, Positano | 2026-03-22 | 2026-03-25 |
| Hotel de Russie, Rome | 2026-03-25 | 2026-03-28 |

The second sample trip (Swiss Alps) has no hotel items in its days, so no changes are needed there.

---

## Schema Reference Doc (`waymark-trips/references/schema.md`)

Update to document the `HotelStay` object and the new `stays` field on `Itinerary`.

---

## What Is NOT Changing

- `ItemTypeSchema` still includes `'hotel'` (used by generated items)
- `TripItem` schema is unchanged
- Timeline rendering (`TimelineItem.astro`) is unchanged — generated hotel items are standard `TripItem` objects
- Day `items` arrays in stored data no longer contain hotel items
