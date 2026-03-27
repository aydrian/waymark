# Waymark Admin API Reference

All endpoints require:
```
Authorization: Bearer $WAYMARK_ADMIN_TOKEN
```

Base URL: `$WAYMARK_BASE_URL`

---

## GET /api/admin/trips/:id

Fetch a complete trip by ID.

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips/a8k3m2q9"
```

**Responses:**
- `200` — full Itinerary JSON
- `401` — missing or invalid token
- `404` — `{"error":"Trip not found"}`

---

## POST /api/admin/trips/upsert

Create or fully replace a trip. The body must be a complete valid Itinerary object (partial updates are not supported — fetch first, then re-POST the full document).

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/waymark_trip.json \
  "$BASE_URL/api/admin/trips/upsert"
```

**Responses:**
- `201` — `{"ok":true,"id":"a8k3m2q9","updatedAt":"2025-09-10T14:30:00.000Z"}`
- `400` — `{"error":"Invalid JSON"}`
- `401` — missing or invalid token
- `422` — `{"error":"Validation failed","issues":[...]}` — Zod validation errors; each issue has `path` (array of field names) and `message`

**Common 422 causes:**
- `id` doesn't match `/^[a-z0-9]{8}$/`
- Missing required fields (`title`, `startDate`, `endDate`, `timezone`, `destinations`, `days`, `pinSalt`, `pinHash`, `updatedAt`)
- Invalid `type` or `status` enum value on a TripItem

---

## POST /api/admin/trips/delete

Delete a trip by ID.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"a8k3m2q9"}' \
  "$BASE_URL/api/admin/trips/delete"
```

**Responses:**
- `200` with `{"ok":true,"deleted":true}` — trip existed and was removed
- `200` with `{"ok":true,"deleted":false}` — trip ID not found (already absent)
- `401` — missing or invalid token

---

## Traveler Access

Trips are accessed by travelers at:
```
$BASE_URL/trip/:id
```

The traveler enters their PIN at this URL to view the itinerary. The PIN is not stored in plain text and cannot be recovered from the API — only the hash is stored.
