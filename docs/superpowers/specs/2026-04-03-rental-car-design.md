# Rental Car Reservation Feature

**Date:** 2026-04-03  
**Status:** Approved

## Context

Waymark supports hotel stays and transport legs (flights, trains, etc.) on trip itineraries. Users also book rental cars, which need pickup and dropoff events on the timeline and should be parseable from confirmation emails. Rental cars don't fit cleanly into `TransportLeg` (no in-transit concept, different fields) or `HotelStay` (two locations, not a stay). A dedicated `RentalCarReservation` schema is the right fit.

---

## Schema

New `RentalCarReservationSchema` added to `src/types/itinerary.ts` alongside `HotelStaySchema` and `TransportLegSchema`:

```ts
const RentalCarReservationSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ItemStatusSchema,
  // Pickup
  pickupDate: z.string(),           // YYYY-MM-DD
  pickupTime: z.string(),           // HH:MM
  pickupTimezone: z.string(),       // IANA e.g. "America/New_York"
  pickupLocation: z.string().optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  // Dropoff
  dropoffDate: z.string(),          // YYYY-MM-DD
  dropoffTime: z.string(),          // HH:MM
  dropoffTimezone: z.string(),      // IANA
  dropoffLocation: z.string().optional(),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  // Rental details
  carClass: z.string().optional(),  // e.g. "Economy", "SUV", "Compact"
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  cost: z.number().nonnegative().optional(),
});
```

`ItinerarySchema` gains a `rentalCars` array field (alongside `stays` and `transportLegs`).

---

## Timeline Generation

**File:** `src/lib/trip-state.ts`

New `getRentalCarItemsForDay(rentalCars, date)` function generates two synthetic `TripItem`s per reservation:

- **Pickup item** (on `pickupDate`):
  - `type: 'transport'`, `_legType: 'pickup'`
  - Shows: time + timezone, pickup location, car class, vendor, confirmation number
  - Cost display: total + cost/day (e.g. "$450 · $75/day")
  - Cost per day = `Math.round(cost / daysBetween(pickupDate, dropoffDate))`

- **Dropoff item** (on `dropoffDate`):
  - `type: 'transport'`, `_legType: 'dropoff'`
  - Shows: time + timezone, dropoff location
  - If dropoff location differs from pickup location, note it as a one-way rental

`GeneratedItem._legType` union is extended: `'departure' | 'arrival' | 'transit' | 'pickup' | 'dropoff'`

---

## Email Processing

**File:** `src/lib/server/email-processor.ts`

New `AiRentalCarSchema` for AI extraction:

```ts
const AiRentalCarSchema = z.object({
  type: z.literal('rental_car'),
  title: z.string(),
  pickupDate: z.string(),
  pickupTime: z.string(),
  pickupTimezone: z.string(),
  pickupLocation: z.string().optional(),
  dropoffDate: z.string(),
  dropoffTime: z.string(),
  dropoffTimezone: z.string(),
  dropoffLocation: z.string().optional(),
  carClass: z.string().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
});
```

- The discriminated union `AiOutputSchema` gains `AiRentalCarSchema` alongside the existing `transport_leg`, `hotel_stay`, and `no_match` branches.
- System prompt updated to instruct the AI to recognize rental car confirmation emails (Enterprise, Hertz, Avis, Budget, National, etc.) and extract the relevant fields.
- A new handler branch creates a `RentalCarReservation` record and appends it to `itinerary.rentalCars`.

---

## Rendering

**File:** `src/components/TimelineItem.astro`

New icon entries keyed off `_legType`:
- `pickup`: 🚗
- `dropoff`: 🏁

**Pickup card:**
- Time + timezone abbreviation
- Pickup location
- Car class + vendor
- Confirmation number
- Cost: "$450 · $75/day"

**Dropoff card:**
- Time + timezone abbreviation
- Dropoff location
- One-way indicator if pickup location ≠ dropoff location

**File:** `src/pages/trip/[id].astro`

`getRentalCarItemsForDay()` called alongside `generateHotelTimelineItems()` and `getTransportItemsForDay()` when building each day's generated items.

---

## Critical Files

| File | Change |
|------|--------|
| `src/types/itinerary.ts` | Add `RentalCarReservationSchema`, `RentalCarReservation` type, add `rentalCars` to `ItinerarySchema` |
| `src/lib/trip-state.ts` | Add `getRentalCarItemsForDay()`, extend `_legType` union |
| `src/lib/server/email-processor.ts` | Add `AiRentalCarSchema`, extend discriminated union, add handler branch, update system prompt |
| `src/components/TimelineItem.astro` | Add pickup/dropoff icon entries and card rendering |
| `src/pages/trip/[id].astro` | Call `getRentalCarItemsForDay()` per day |

---

## Verification

1. Add a `RentalCarReservation` manually to a trip's KV data and confirm pickup + dropoff events appear on the correct days with correct cost/day display.
2. Send a rental car confirmation email through the email processor and verify it creates a `RentalCarReservation` in the correct trip.
3. Test a one-way rental (different pickup/dropoff locations) — confirm both locations display correctly and the one-way indicator appears on the dropoff card.
4. Confirm multi-timezone rentals (pickup in EST, dropoff in PST) sort correctly on the timeline.
5. Run `bun test` to confirm existing hotel/transport email tests still pass.
