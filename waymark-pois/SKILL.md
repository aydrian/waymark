---
name: waymark-pois
description: Add, update, remove, and list Places of Interest (POIs) on Waymark trips using MCP tools. Manage Global POIs and assign them to trip itineraries. Use whenever the user wants to add a recommendation, attraction, restaurant, shop, or any place of interest to a Waymark trip.
---

# Waymark POI Manager

A skill for managing Places of Interest on Waymark trips via MCP (Model Context Protocol) tools.

**Announce at the start:** "I'm using the waymark-pois skill with MCP tools to handle this."

---

## Required Environment Variables

The MCP server requires these environment variables:

| Variable | Description |
|---|---|
| `WAYMARK_BASE_URL` | The Waymark instance URL (e.g., `https://waymark.itsaydrian.com`) |
| `WAYMARK_ADMIN_TOKEN` | Your admin API token for authentication |

If these are not set, ask the user to provide them.

---

## Available MCP Tools

| Tool | Purpose |
|---|---|
| `list_pois` | List all global POIs |
| `get_poi` | Get a specific POI by ID |
| `create_poi` | Create a new global POI |
| `update_poi` | Update an existing POI |
| `delete_poi` | Delete a POI |
| `search_pois` | Search POIs by city, category, or name |
| `get_trip` | Get trip (to see assigned POIs) |
| `update_trip` | Update trip (to modify poiReferences) |

---

## Determine the Operation

| User intent | Operation |
|---|---|
| "create global POI", "add to global list" | [Create Global POI](#create-global-poi) |
| "list global POIs", "show all POIs" | [List Global POIs](#list-global-pois) |
| "update", "edit", "change" a POI | [Update Global POI](#update-global-poi) |
| "remove", "delete" from global list | [Delete Global POI](#delete-global-poi) |
| "search POIs", "find places" | [Search POIs](#search-pois) |
| "what POIs on trip X" | [List Trip POIs](#list-trip-pois) |
| "add POI to trip" | [Add POI to Trip](#add-poi-to-trip) |

---

## Global POI Fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Display name of the place |
| `category` | yes | `restaurant`, `attraction`, `shop`, `outdoor`, `entertainment`, `other` |
| `city` | yes | Free-form city name |
| `address` | no | Street address |
| `lat` | no | Decimal latitude |
| `lng` | no | Decimal longitude |
| `website` | no | Full URL with `https://` |
| `googleMapsUrl` | no | Full Google Maps URL |
| `description` | no | Short description |
| `advisorNotes` | no | Travel advisor recommendation or tip |

---

## Create Global POI

**Tool:** `create_poi`

**Arguments:**
```json
{
  "name": "Place Name",
  "category": "restaurant",
  "city": "City Name",
  "address": "Optional address",
  "lat": 40.1234,
  "lng": -74.5678,
  "website": "https://example.com",
  "googleMapsUrl": "https://maps.google.com/...",
  "description": "Optional description",
  "advisorNotes": "Optional advisor notes"
}
```

Only `name`, `category`, and `city` are required.

---

## List Global POIs

**Tool:** `list_pois` (no arguments)

Returns all global POIs sorted by name. Display as a table: name, category, city, id.

---

## Update Global POI

**Tool:** `update_poi`

**Arguments:**
```json
{
  "id": "POI_UUID",
  "name": "Updated Name",
  "category": "attraction"
}
```

Only include fields that need to change. The `id` is required.

---

## Delete Global POI

**Tool:** `delete_poi`

**Arguments:**
```json
{
  "id": "POI_UUID"
}
```

---

## Search POIs

**Tool:** `search_pois`

**Arguments:**
```json
{
  "city": "Rome",
  "category": "restaurant",
  "name": "pasta"
}
```

All arguments are optional. Combine filters as needed. Returns POIs matching all criteria.

---

## List Trip POIs

**Tool:** `get_trip`

1. Call `get_trip` with the trip ID
2. Extract the `poiReferences` array from the response
3. Display with resolved POI data (names are in poiSnapshot or fetch via `get_poi`)

---

## Add POI to Trip

To add a POI to a trip, you need to update the trip's `poiReferences` array:

1. Fetch the trip: `get_trip` with the trip ID
2. Add the POI reference to `poiReferences`:
   ```json
   {
     "poiId": "POI_UUID",
     "tripAdvisorNotes": "Optional notes for this trip"
   }
   ```
3. Update the trip with `update_trip` including the complete trip object

**Note:** Adding to `poiReferences` makes the POI available on the trip. To schedule it on a specific day, use `create_assignment` (see waymark-trips skill).

---

## Add POI from Google Maps

Accepts a Google Maps URL and extracts place data.

1. **Gather inputs:**
   - Google Maps URL (short or long)
   - Category (required - cannot be auto-detected)
   - City (ask user to confirm or provide)

2. **Resolve shortened URLs:**
   ```bash
   curl -sI "https://maps.app.goo.gl/XXXX" | grep -i location
   ```

3. **Extract from full URL:**
   - Place name: from `/place/NAME` segment (URL-decoded, underscores→spaces)
   - Coordinates: from `/@LAT,LNG` or `!3dLAT!4dLNG` patterns

4. **Create the POI** using `create_poi` with extracted data.

---

## Error Handling

| Error | Meaning | Action |
|---|---|---|
| Validation error | Invalid input | Check issues array for specific fields |
| POI not found | 404 from API | Confirm the POI ID |
| Configuration error | Missing env vars | Ask for WAYMARK_BASE_URL and WAYMARK_ADMIN_TOKEN |

---

## After Any Write

Always show relevant URLs:
- Global POI: `<WAYMARK_BASE_URL>/admin/pois` (admin POI list)
- Trip with POI: `<WAYMARK_BASE_URL>/trip/<tripId>`
