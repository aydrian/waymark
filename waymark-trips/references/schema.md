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
| `map` | object | no | `{ centerLat?, centerLng?, zoom? }` — all optional numbers |

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

### Item type enum values

| Value | When to use |
|---|---|
| `hotel` | Accommodation check-in/check-out |
| `transport` | Flights, trains, buses, ferries |
| `activity` | Tours, excursions, museum visits, sightseeing |
| `restaurant` | Dining reservations |
| `transfer` | Airport/hotel transfers, taxis, car hire |
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
