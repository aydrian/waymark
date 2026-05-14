# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-05-14

### Added

- Added `TripStatusSchema` with 7 statuses: `planning`, `booking`, `travel_ready`, `traveling`, `post_trip`, `completed`, `closed_lost`
- Added `status`, `statusReason`, and `statusChangedAt` fields to `ItinerarySchema`
- Added `status` to `TripSummary` type
- Updated `listTrips` to include `status` in returned summaries

## [0.0.1] - 2025-04-30

### Added

- Initial public release of @itsaydrian/waymark-shared
- Shared types for Waymark itinerary management:
  - Core types: `Itinerary`, `TripSummary`, `PlaceOfInterest`, `PoiAssignment`
  - Day/activity types: `Day`, `TripItem`, `Activity`, `HotelStay`
  - Transport types: `TransportLeg`, `RentalCarReservation`
  - Status and category enums: `ItemStatus`, `PlaceCategory`
- Shared library functions:
  - KV storage: `getTrip`, `putTrip`, `listTrips`, `deleteTrip`
  - Global POI: `getGlobalPOI`, `putGlobalPOI`, `listGlobalPOIs`, `deleteGlobalPOI`
  - Assignments: `getAssignment`, `putAssignment`, `listAssignments`, `deleteAssignment`
- Zod schemas for runtime validation of all types
- Full TypeScript type definitions

### Notes

- This is the first public release. The package provides shared types and utilities used by both the Waymark web app and MCP server.
