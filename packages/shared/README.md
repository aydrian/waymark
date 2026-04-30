# Waymark Shared

Shared types and utilities for the Waymark travel itinerary platform.

## Overview

This package provides:

- **TypeScript types** for itineraries, POIs, assignments, and transport
- **Zod schemas** for runtime validation
- **KV storage helpers** for Cloudflare Workers KV operations

Used by:
- `@itsaydrian/waymark-mcp-server` - MCP server for agent access
- `@waymark/web` - Astro web application

## Installation

```bash
npm install @itsaydrian/waymark-shared
```

## Usage

### Types

```typescript
import type { Itinerary, PlaceOfInterest, Day } from '@itsaydrian/waymark-shared/types';
```

### Library Functions

```typescript
import { getTrip, putTrip, listTrips } from '@itsaydrian/waymark-shared/lib';
```

### Schemas

```typescript
import { ItinerarySchema, PlaceOfInterestSchema } from '@itsaydrian/waymark-shared';
```

## Available Types

### Core Types

- `Itinerary` - Complete trip with days, activities, and metadata
- `TripSummary` - Lightweight trip info for listing
- `PlaceOfInterest` - Reusable POI with location and category
- `PoiAssignment` - Links a POI to a specific trip/day
- `GlobalPOI` - Top-level POI storage format

### Day & Activity Types

- `Day` - A day in an itinerary with activities
- `TripItem` - Union of activity types (Activity, HotelStay, TransportLeg, etc.)
- `Activity` - Scheduled activity with time and cost
- `HotelStay` - Hotel booking with check-in/out dates

### Transport Types

- `TransportLeg` - Flight, train, or other transport segment
- `RentalCarReservation` - Car rental with pickup/dropoff

### Enums

- `ItemStatus` - `confirmed` | `pending` | `idea`
- `PlaceCategory` - `restaurant` | `sightseeing` | `shopping` | `lodging` | `transport`

## License

MIT
