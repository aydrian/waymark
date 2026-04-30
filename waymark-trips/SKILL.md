---
name: waymark-trips
description: Create, update, delete, and manage trips in the Waymark travel itinerary app using MCP tools. Use whenever the user wants to add a new trip, edit an existing itinerary, remove a trip, manage waymark trip data, build a trip JSON for waymark, or work with any waymark travel itinerary.
---

# Waymark Trip Manager

A skill for full CRUD management of trips in Waymark via MCP (Model Context Protocol) tools.

**Announce at the start:** "I'm using the waymark-trips skill with MCP tools to handle this."

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
| `list_trips` | Get all trips summary |
| `get_trip` | Get full trip details by ID |
| `create_trip` | Create a new trip |
| `update_trip` | Update an existing trip |
| `delete_trip` | Delete a trip |
| `list_assignments` | List POI assignments for a trip |
| `create_assignment` | Assign a POI to a day |
| `update_assignment` | Update an assignment |
| `delete_assignment` | Remove an assignment |

---

## Determine the Operation

| User intent | Operation |
|---|---|
| "create a trip", "add a new trip", "make a waymark trip" | [Create Trip](#create-trip) |
| "update", "edit", "change", "add a day to" | [Update Trip](#update-trip) |
| "delete", "remove" | [Delete Trip](#delete-trip) |
| "fetch", "show me", "get trip", "what's in trip X" | [Get Trip](#get-trip) |
| "list trips", "show all trips", "what trips exist" | [List Trips](#list-trips) |
| "assign POI", "add to itinerary", "schedule" | [Create Assignment](#create-assignment) |
| "list assignments", "what's scheduled" | [List Assignments](#list-assignments) |

---

## List Trips

**Tool:** `list_trips` (no arguments)

Invoke the tool and display the results as a table showing id, title, dates, destinations, and travelers.

---

## Get Trip

**Tool:** `get_trip`

**Arguments:**
```json
{
  "id": "TRIP_ID"
}
```

Display the full trip JSON in a readable format. Summarize key fields (title, dates, destinations, day count, item count).

---

## Create Trip

**Tool:** `create_trip`

### Gather Required Fields

Ask the user for:
- Trip title
- Start and end dates (YYYY-MM-DD)
- Timezone (IANA format, e.g., `America/New_York`, `Europe/Rome`)
- Destinations (list of place names)
- Days structure (can start minimal)
- PIN (a short code for traveler access)

### Generate Trip ID

Generate an 8-character lowercase alphanumeric ID:
```bash
node -e "const c='abcdefghijklmnopqrstuvwxyz0123456789';let s='';for(let i=0;i<8;i++)s+=c[Math.floor(Math.random()*36)];console.log(s);"
```

Show the ID to the user and allow them to override it.

### Build and Create

Construct the trip object and call `create_trip`:

```json
{
  "id": "GENERATED_ID",
  "title": "Trip Title",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "timezone": "America/New_York",
  "destinations": ["City, Country"],
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayNumber": 1,
      "title": "Day 1",
      "items": []
    }
  ],
  "pin": "USER_PROVIDED_PIN"
}
```

**Note:** The `pin` field will be automatically hashed by the MCP server. Do NOT generate pinSalt/pinHash manually.

On success, show:
```
Trip created!
  ID:  <id>
  URL: <WAYMARK_BASE_URL>/trip/<id>
  PIN: <the plain PIN>
```

---

## Update Trip

**Tool:** `update_trip`

1. First, fetch the existing trip with `get_trip`
2. Apply the user's requested changes
3. Set `updatedAt` to current ISO timestamp
4. Call `update_trip` with the complete trip object

**Important:** Include ALL fields from the original trip, not just the changes.

If changing the PIN: just set the new `pin` field (plain text). The server will hash it automatically.

---

## Delete Trip

**Tool:** `delete_trip`

**Arguments:**
```json
{
  "id": "TRIP_ID"
}
```

Confirm the trip ID with the user before deleting. Optionally fetch it first for verification.

---

## Create Assignment

**Tool:** `create_assignment`

Assign a POI to a specific day in the itinerary.

**Arguments:**
```json
{
  "tripId": "TRIP_ID",
  "poiId": "POI_UUID",
  "dayNumber": 2,
  "startTime": "19:00",
  "endTime": "21:00",
  "allDay": false,
  "clientNotes": "Optional notes"
}
```

Only `tripId`, `poiId`, and `dayNumber` are required. Times are optional (HH:MM format).

---

## List Assignments

**Tool:** `list_assignments`

**Arguments:**
```json
{
  "tripId": "TRIP_ID",
  "dayNumber": 2
}
```

`dayNumber` is optional - omit to get all assignments for the trip.

---

## Error Handling

The MCP tools return structured errors:

| Error | Meaning | Action |
|---|---|---|
| Validation error | Invalid input data | Check the issues array and fix the specified fields |
| Trip not found | 404 from API | Confirm the trip ID with the user |
| Configuration error | Missing env vars | Ask user to set WAYMARK_BASE_URL and WAYMARK_ADMIN_TOKEN |

For validation errors, the response includes an `issues` array with specific field paths and messages.

---

## After Any Write

Always show the trip URL: `$WAYMARK_BASE_URL/trip/<id>`

For creates: Remind the user to share both the URL and PIN with the traveler.
For updates: Note which fields changed.
For deletes: Confirm the URL is now inaccessible.
