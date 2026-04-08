---
name: waymark-trips
description: Create, update, delete, and manage trips in the Waymark travel itinerary app. Use whenever the user wants to add a new trip, edit an existing itinerary, remove a trip, manage waymark trip data, build a trip JSON for waymark, or work with any waymark travel itinerary — even if they don't say "waymark" explicitly, trigger if context makes clear the target is a waymark deployment.
---

# Waymark Trip Manager

A skill for full CRUD management of trips in a Waymark deployment via its admin API.

Announce at the start: "I'm using the waymark-trips skill to handle this."

Read `references/schema.md` for full field constraints and `references/api.md` for curl examples whenever you need detail beyond what's covered here.

---

## Step 1: Resolve Configuration

You need two values before doing anything:

| Variable | How to find it |
|---|---|
| `WAYMARK_BASE_URL` | Check `$WAYMARK_BASE_URL` env var → default to `https://waymark.itsaydrian.com` |
| `WAYMARK_ADMIN_TOKEN` | Check `$WAYMARK_ADMIN_TOKEN` env var → check `.dev.vars` in cwd if at waymark project root → ask the user |

If both are set in the environment, proceed silently. Never echo the token in output.

If the user is at the waymark project root, you can extract the token from `.dev.vars`:
```bash
grep ADMIN_API_TOKEN .dev.vars 2>/dev/null | cut -d= -f2
```

---

## Step 2: Determine the Operation

| User intent | Operation |
|---|---|
| "create a trip", "add a new trip", "make a waymark trip" | [Create](#create-a-trip) |
| "update", "edit", "change", "add a day to" | [Update](#update-a-trip) |
| "delete", "remove" | [Delete](#delete-a-trip) |
| "fetch", "show me", "get trip", "what's in trip X" | [Fetch](#fetch-a-trip) |
| "list trips", "show all trips", "what trips exist", "discover trips" | [List](#list-trips) |

---

## List Trips

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips"
```

On 200: display a table of all trips (id, title, dates, destinations, travelers). Use this to discover trip IDs before fetching or updating.

---

## Fetch a Trip

```bash
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/trips/TRIP_ID"
```

On 200: pretty-print the JSON and summarize key fields (title, dates, destinations, day count, item count).
On 404: tell the user the trip ID was not found.

---

## Create a Trip

### Gather trip details

Ask the user for any missing required fields:
- Trip title
- Start and end dates (YYYY-MM-DD)
- Timezone (IANA format, e.g. `America/New_York`, `Europe/Rome`)
- Destinations (list of place names)
- Days and their activities (can start minimal — the trip can be updated later)
- PIN (a short code the traveler will use to access the trip)

**Generate a trip ID** — must be exactly 8 lowercase alphanumeric characters:
```bash
node -e "const c='abcdefghijklmnopqrstuvwxyz0123456789';let s='';for(let i=0;i<8;i++)s+=c[Math.floor(Math.random()*36)];console.log(s);"
```

Show the proposed ID to the user and let them override it.

### Generate the PIN hash

Never store a plain PIN. Always derive salt + hash using PBKDF2-SHA256 (100k iterations):

```bash
# Step 1: generate a random 32-char hex salt (16 random bytes)
SALT=$(node -e "const b=new Uint8Array(16);crypto.getRandomValues(b);console.log(Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(''));")

# Step 2: derive the hash — substitute YOUR_PIN with the actual PIN
HASH=$(node -e "
(async()=>{
  const pin='YOUR_PIN';
  const salt='$SALT';
  const enc=new TextEncoder();
  const km=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},km,256);
  console.log(Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join(''));
})();
")
```

If the waymark project is available at the cwd, you can use the script instead of Step 2:
```bash
# bun scripts/hash-pin.ts <pin> <salt>  →  prints the 64-char hex hash
HASH=$(bun scripts/hash-pin.ts YOUR_PIN "$SALT")
```

Both approaches produce identical output — the script uses the same algorithm.

### Build the trip JSON

Write the itinerary to a temp file. See `references/schema.md` for all field constraints. Minimum valid structure:

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
      "title": "Day 1 — Arrival",
      "items": []
    }
  ],
  "pois": [],
  "pinSalt": "SALT_FROM_ABOVE",
  "pinHash": "HASH_FROM_ABOVE",
  "updatedAt": "ISO_DATETIME"
}
```

Generate `updatedAt`:
```bash
node -e "console.log(new Date().toISOString())"
```

Each `TripItem` needs a unique `id` within its day — use short random strings:
```bash
node -e "console.log(Math.random().toString(36).slice(2,8))"
```

### POST to upsert

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/waymark_trip.json \
  "$BASE_URL/api/admin/trips/upsert"
```

On success (`201 {"ok":true,...}`), show the user:

```
Trip created!
  ID:  <id>
  URL: <BASE_URL>/trip/<id>
  PIN: <the plain PIN>
```

Remind the user: the traveler needs both the URL and the PIN. The PIN cannot be recovered from the API later (only its hash is stored).

---

## Update a Trip

Fetch the existing trip first (see [Fetch](#fetch-a-trip)), apply only the changes the user requested, set `updatedAt` to now, then POST to `/api/admin/trips/upsert`.

If the user wants to change the PIN: regenerate both `pinSalt` and `pinHash` following the steps above with the new PIN. The old PIN stops working immediately.

Do not silently drop any existing `days` or `items` — confirm with the user before removing content.

---

## Delete a Trip

Confirm the trip ID with the user before deleting. Optionally fetch it first so the user can verify they have the right trip.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"TRIP_ID\"}" \
  "$BASE_URL/api/admin/trips/delete"
```

- `{"ok":true,"deleted":true}` — trip was removed
- `{"ok":true,"deleted":false}` — trip ID not found (already gone)

---

## Error Handling

| HTTP Status | Meaning | Action |
|---|---|---|
| 401 | Bad or missing token | Verify `WAYMARK_ADMIN_TOKEN` and re-prompt the user |
| 400 | Malformed JSON | Check syntax before retrying |
| 422 | Schema validation failed | Read the `issues` array and tell the user exactly which fields failed and why |
| 404 | Trip not found | Confirm the ID with the user |

For 422 errors, the response body contains a Zod `issues` array. Surface each issue's `path` and `message` in plain language. Common causes:
- `id` not exactly 8 lowercase alphanumeric characters
- `pinSalt` or `pinHash` empty or malformed
- Missing required fields (`title`, `startDate`, `endDate`, `timezone`, `destinations`, `days`, `updatedAt`)
- Invalid `type` or `status` enum value on an item

---

## After Any Successful Write

Always show the trip URL: `<BASE_URL>/trip/<id>`

For creates: remind the user to share both the URL and PIN with the traveler.
For updates: note which fields changed.
For deletes: confirm the URL is now inaccessible.
