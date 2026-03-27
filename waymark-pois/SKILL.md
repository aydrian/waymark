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
