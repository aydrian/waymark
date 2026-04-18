---
name: waymark-pois
description: Add, update, remove, and list Places of Interest (POIs) on Waymark trips. Manage Global POIs and assign them to trip itineraries. Use whenever the user wants to add a recommendation, attraction, restaurant, shop, or any place of interest to a Waymark trip — even phrased as "add a place", "add a recommendation", "remove that spot", "what POIs are on trip X", "create global POI", or "assign to itinerary".
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
| "add a place", "recommend X", "add POI" to a specific trip | [Add Global POI to Trip](#add-global-poi-to-trip) |
| "create global POI", "add to global list" | [Create Global POI](#create-global-poi) |
| "list global POIs", "show all POIs" | [List Global POIs](#list-global-pois) |
| "update", "edit", "change", "add the website for" a POI | [Update Global POI](#update-global-poi) |
| "remove", "delete", "take out" from global list | [Remove Global POI](#remove-global-poi) |
| "remove from trip" | [Remove POI from Trip](#remove-poi-from-trip) |
| "list", "show", "what POIs", "what places" on a trip | [List Trip POIs](#list-trip-pois) |
| "assign to day", "schedule POI", "add to itinerary" | [Assign POI to Itinerary](#assign-poi-to-itinerary) |
| "migrate POIs" | Run the migration script at `scripts/migrate-pois.ts` |

If the user hasn't specified a trip ID, ask for it before proceeding.

---

## Global POI Fields

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
| `advisorNotes` | no | Travel advisor recommendation or tip (visible to all trips using this POI) |

---

## Create Global POI

Create a reusable POI in the global repository.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PLACE_NAME",
    "category": "CATEGORY",
    "city": "CITY"
  }' \
  "$BASE_URL/api/admin/pois"
```

On `201`: show the POI was created with its ID.
On `422`: surface the `issues` array in plain language.

---

## List Global POIs

List all reusable POIs in the global repository.

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/pois"
```

Display in a readable table: name, category, city, ID.

---

## Update Global POI

Update fields on a global POI.

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"FIELD": "NEW_VALUE"}' \
  "$BASE_URL/api/admin/pois/POI_ID"
```

Only include fields being changed. On `200`: confirm which fields were updated.

---

## Remove Global POI

Delete a POI from the global repository (only if not used by any trips).

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/pois/POI_ID"
```

On `200`: confirm removal. On `404`: POI not found or in use.

---

## Add Global POI to Trip

Add a global POI to a specific trip, creating a trip reference with optional trip-specific notes.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "poiId": "GLOBAL_POI_ID",
    "tripAdvisorNotes": "Optional client-specific notes"
  }' \
  "$BASE_URL/api/admin/trips/TRIP_ID/pois"
```

On `201`: the POI was added to the trip.
On `409`: the POI is already on this trip.

---

## Remove POI from Trip

Remove a POI reference from a trip (POI remains in global repository).

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips/TRIP_ID/pois/POI_ID"
```

On `200`: confirm removal from trip.

---

## List Trip POIs

List all POIs on a specific trip (resolves global POI data with trip-specific notes).

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips/TRIP_ID"
```

Extract and display the `poiReferences` array with resolved global POI data.

---

## Assign POI to Itinerary

Assign a trip POI to a specific day and time in the itinerary (client-facing endpoint).
Requires trip access cookie or admin session.

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{
    "poiId": "GLOBAL_POI_ID",
    "dayNumber": 2,
    "startTime": "19:00",
    "endTime": "21:00",
    "allDay": false,
    "clientNotes": "Reservation under Smith"
  }' \
  "$BASE_URL/api/trips/TRIP_ID/assignments"
```

On `201`: the POI was assigned to the day.

---

## Add POI from Google Maps

Accepts a Google Maps URL (full or shortened) and extracts available place data.

1. **Gather inputs from user:**
   - Google Maps URL (short or long form)
   - Category (required — cannot be auto-detected from URL)
   - City (ask user to confirm or provide)

2. **Resolve shortened URLs:**
   ```bash
   # Follow redirects to get the full URL
   curl -sI "https://maps.app.goo.gl/XXXX" | grep -i location
   ```

3. **Extract from the full URL:**
   - **Place name**: from `/place/NAME` path segment (URL-decoded, underscores→spaces)
   - **Coordinates**: from `/@LAT,LNG` or `!3dLAT!4dLNG` patterns
   - Example: `https://www.google.com/maps/place/Le_Sirenuse/@40.6283,14.4876`
     - Name: "Le Sirenuse"
     - Lat: 40.6283, Lng: 14.4876

4. **Present extracted data to user for confirmation:**
   - Name (auto-extracted or editable)
   - Coordinates (auto-extracted or manual)
   - Category (user-provided)
   - City (user-provided)

5. **Create Global POI first**, then optionally add to trip.

---

## Migration Notes

If the user mentions duplicate POIs across trips or wants to migrate legacy embedded POIs:

1. **Dry run first:**
   ```bash
   bun run scripts/migrate-pois.ts --dry-run
   ```

2. **Apply migration:**
   ```bash
   wrangler dev --local -- bun run scripts/migrate-pois.ts
   ```

This extracts unique POIs from all trips, creates Global POIs, and updates trips to use `poiReferences`.

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
| 409 | POI already on trip | Inform user, no action needed |
| 422 | Validation failed | Surface `issues[].message` in plain language |
