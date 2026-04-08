# Waymark Schema Reference

Source of truth: `src/types/itinerary.ts` in the waymark project.

---

## Itinerary (top-level object)

| Field | Type | Required | Constraints |
|---|---|---|---|
| `id` | string | yes | Exactly 8 lowercase alphanumeric chars — regex `/^[a-z0-9]{8}$/` |
| `title` | string | yes | Non-empty |
| `startDate` | string | yes | YYYY-MM-DD |
| `endDate` | string | yes | YYYY-MM-DD |
| `timezone` | string | yes | IANA timezone (e.g. `Europe/Rome`, `America/Chicago`) |
| `summary` | string | no | Free text overview |
| `travelers` | string[] | no | Names of the travelers on the trip |
| `destinations` | string[] | yes | Array of place names (at least one recommended) |
| `days` | Day[] | yes | Array of daily plans (see below) |
| `notes` | string | no | General trip notes |
| `pinSalt` | string | yes | 32-char hex string (16 random bytes encoded as hex) |
| `pinHash` | string | yes | 64-char hex string (PBKDF2-SHA256 output, 256 bits) |
| `updatedAt` | string | yes | ISO 8601 datetime, e.g. `2025-09-10T14:30:00.000Z` |
| `stays` | HotelStay[] | no | Array of hotel stays (see below). Do NOT add `type: 'hotel'` items to day `items` — check-in/checkout timeline entries are generated at render time from this array. |
| `transportLegs` | TransportLeg[] | no | Array of transport legs (see below). Preferred over `type: 'transport'` TripItems for flights, trains, ferries, and buses. Departure/arrival/in-transit entries are generated at render time. |
| `rentalCars` | RentalCarReservation[] | no | Array of rental car reservations (see below). Pickup and dropoff timeline entries are generated at render time from this array. |
| `map` | object | no | `{ centerLat?, centerLng?, zoom? }` — all optional numbers |
| `baseCurrency` | string | no | 3-letter ISO currency code, e.g. `"USD"`, `"EUR"`, `"GBP"`. Defaults to `"USD"` |

---

## Day

| Field | Type | Required | Constraints |
|---|---|---|---|
| `date` | string | yes | YYYY-MM-DD (should match the trip timezone) |
| `dayNumber` | number | yes | Positive integer starting at 1 |
| `title` | string | yes | e.g. `"Day 1 — Arrival"` |
| `notes` | string | no | Free text |
| `items` | TripItem[] | yes | Can be an empty array `[]` |

Days should be contiguous and cover the full trip from `startDate` to `endDate`.

---

## HotelStay

Represents a multi-night hotel stay. Stored at the itinerary level (not inside a day's items).

| Field | Type | Required | Constraints |
|---|---|---|---|
| `id` | string | yes | Unique within the trip |
| `title` | string | yes | Hotel name, e.g. `"Le Sirenuse"` |
| `status` | enum | yes | See status values below |
| `checkinDate` | string | yes | YYYY-MM-DD |
| `checkinTime` | string | no | HH:MM (24-hour) |
| `checkoutDate` | string | yes | YYYY-MM-DD |
| `checkoutTime` | string | no | HH:MM (24-hour) |
| `location` | string | no | Venue or area name |
| `address` | string | no | Full street address |
| `lat` | number | no | WGS84 latitude (for map pin) |
| `lng` | number | no | WGS84 longitude (for map pin) |
| `vendor` | string | no | Hotel chain name |
| `confirmationNumber` | string | no | Booking reference |
| `notes` | string | no | Room type, inclusions, special requests |
| `cost` | number | no | Non-negative. Total cost of the stay (e.g. full room charge) |
| `costCurrency` | string | no | 3-letter ISO currency code. Defaults to `"USD"` |

---

## TransportLeg

Represents a point-to-point transport leg (flight, train, ferry, bus). Stored at the itinerary level (not inside a day's items). The app generates 🛫 departure, ✈️ in-transit, and 🛬 arrival timeline entries automatically from this data.

**Use this instead of a `type: 'transport'` TripItem** whenever the leg has distinct departure and arrival locations, timezones, or could span overnight.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `id` | string | yes | Unique within the trip |
| `type` | enum | yes | `flight` \| `train` \| `ferry` \| `bus` \| `other` |
| `title` | string | yes | e.g. `"Flight NCE → NAP"` |
| `status` | enum | yes | See status values below |
| `departureDate` | string | yes | YYYY-MM-DD |
| `departureTime` | string | yes | HH:MM (24-hour, local time at departure point) |
| `departureTimezone` | string | yes | IANA timezone of departure location (e.g. `"Europe/Paris"`) |
| `departureLocation` | string | no | Human-readable name, e.g. `"Nice Côte d'Azur Airport (NCE)"` |
| `departureLat` | number | no | WGS84 latitude of departure point (for map pin) |
| `departureLng` | number | no | WGS84 longitude of departure point (for map pin) |
| `arrivalDate` | string | yes | YYYY-MM-DD — set to next day for overnight legs |
| `arrivalTime` | string | yes | HH:MM (24-hour, local time at arrival point) |
| `arrivalTimezone` | string | yes | IANA timezone of arrival location (e.g. `"Europe/Rome"`) |
| `arrivalLocation` | string | no | Human-readable name, e.g. `"Naples International Airport (NAP)"` |
| `arrivalLat` | number | no | WGS84 latitude of arrival point (for map pin) |
| `arrivalLng` | number | no | WGS84 longitude of arrival point (for map pin) |
| `vendor` | string | no | Airline or operator name |
| `confirmationNumber` | string | no | Booking reference |
| `seat` | string | no | Seat assignment, e.g. `"12A"` or `"41/42"` |
| `notes` | string | no | Free text |
| `cost` | number | no | Non-negative. Total fare for this leg |
| `costCurrency` | string | no | 3-letter ISO currency code. Defaults to `"USD"` |

---

## RentalCarReservation

Represents a rental car booking. Stored at the itinerary level in `rentalCars` (same pattern as `stays` and `transportLegs`). The app synthesizes a 🚗 pickup event on `pickupDate` and a dropoff event on `dropoffDate` automatically — do not add manual `TripItem`s for the pickup/dropoff.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `id` | string | yes | Unique within the trip |
| `title` | string | yes | e.g. `"Hertz — Rome pickup"` |
| `status` | enum | yes | See status values below |
| `pickupDate` | string | yes | YYYY-MM-DD |
| `pickupTime` | string | yes | HH:MM (24-hour, local time) |
| `pickupTimezone` | string | yes | IANA timezone of pickup location |
| `pickupLocation` | string | no | Human-readable name, e.g. `"Rome Fiumicino Airport (FCO)"` |
| `pickupLat` | number | no | WGS84 latitude |
| `pickupLng` | number | no | WGS84 longitude |
| `dropoffDate` | string | yes | YYYY-MM-DD |
| `dropoffTime` | string | yes | HH:MM (24-hour, local time) |
| `dropoffTimezone` | string | yes | IANA timezone of dropoff location |
| `dropoffLocation` | string | no | Human-readable name |
| `dropoffLat` | number | no | WGS84 latitude |
| `dropoffLng` | number | no | WGS84 longitude |
| `carClass` | string | no | e.g. `"Economy"`, `"Compact"`, `"SUV"`, `"Full-size"` |
| `vendor` | string | no | Rental company, e.g. `"Hertz"`, `"Enterprise"`, `"Avis"` |
| `confirmationNumber` | string | no | Booking reference |
| `notes` | string | no | Free text |
| `cost` | number | no | Non-negative. Total cost of the rental — the UI displays this as total + per-day breakdown (e.g. `$450 · $75/day`) |
| `costCurrency` | string | no | 3-letter ISO currency code. Defaults to `"USD"` |

---

## TripItem

| Field | Type | Required | Constraints |
|---|---|---|---|
| `id` | string | yes | Unique within the containing day (not globally) |
| `type` | enum | yes | See item types below |
| `title` | string | yes | Non-empty |
| `status` | enum | yes | See status values below |
| `startTime` | string | no | HH:MM (24-hour format) |
| `endTime` | string | no | HH:MM (24-hour format) |
| `location` | string | no | Venue or area name |
| `address` | string | no | Full street address |
| `lat` | number | no | WGS84 latitude (for map pin) |
| `lng` | number | no | WGS84 longitude (for map pin) |
| `vendor` | string | no | Airline, hotel chain, restaurant name, etc. |
| `confirmationNumber` | string | no | Booking reference or confirmation code |
| `notes` | string | no | Free text |
| `cost` | number | no | Non-negative. Cost of this activity, transfer, or item |
| `costCurrency` | string | no | 3-letter ISO currency code. Defaults to `"USD"` |

### Item type enum values

| Value | When to use |
|---|---|
| `hotel` | Generated at render time from `stays` — do not store in day `items` |
| `transport` | Legacy only — prefer `TransportLeg` in `transportLegs` for flights/trains/ferries/buses |
| `activity` | Tours, excursions, museum visits, sightseeing |
| `restaurant` | Dining reservations |
| `transfer` | Local ground transfers (taxi, car hire, shuttle) with no distinct arrival airport/station |
| `note` | Free-form annotations or reminders |

### Item status enum values

| Value | Meaning |
|---|---|
| `booked` | Confirmed reservation |
| `quoted` | Price obtained, not yet booked |
| `pending` | Under consideration, no quote yet |
| `canceled` | Was booked, now canceled |

---

## PIN Hash Algorithm

The app uses PBKDF2-SHA256 with these exact parameters:
- **Iterations**: 100,000
- **Hash**: SHA-256
- **Key material**: PIN encoded as UTF-8
- **Salt**: the `pinSalt` hex string encoded as UTF-8 (not decoded to bytes)
- **Output length**: 256 bits → 64 hex chars

Both `pinSalt` and `pinHash` are hex strings. The salt is 32 hex chars (16 random bytes → hex). The hash is 64 hex chars (32 bytes output).

**Critical**: The salt is passed to PBKDF2 as a UTF-8 string (the hex characters themselves), not as binary. This matches how `scripts/hash-pin.ts` and `src/lib/pin.ts` both use `enc.encode(salt)`.
