"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItinerarySchema = exports.MapConfigSchema = exports.DaySchema = exports.DayItemSchema = exports.TripItemBaseSchema = exports.RentalCarReservationSchema = exports.TransportLegSchema = exports.PlaceOfInterestSchema = exports.PoiAssignmentSchema = exports.TripPOIReferenceSchema = exports.GlobalPOISchema = exports.PoiCategorySchema = exports.HotelStaySchema = exports.ItemStatusSchema = exports.ItemTypeSchema = void 0;
var zod_1 = require("zod");
exports.ItemTypeSchema = zod_1.z.enum([
    'hotel', 'transport', 'activity', 'note', 'restaurant', 'transfer',
]);
exports.ItemStatusSchema = zod_1.z.enum([
    'booked', 'quoted', 'pending', 'canceled',
]);
exports.HotelStaySchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    status: exports.ItemStatusSchema,
    checkinDate: zod_1.z.string(), // YYYY-MM-DD
    checkinTime: zod_1.z.string().optional(), // HH:MM
    checkoutDate: zod_1.z.string(), // YYYY-MM-DD
    checkoutTime: zod_1.z.string().optional(), // HH:MM
    location: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
    googleMapsUrl: zod_1.z.string().url().optional(),
    vendor: zod_1.z.string().optional(),
    confirmationNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    cost: zod_1.z.number().nonnegative().optional(),
    costCurrency: zod_1.z.string().length(3).default('USD').optional(),
});
exports.PoiCategorySchema = zod_1.z.enum([
    'restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other',
]);
// Global POI stored in KV at poi:${id} - reusable across trips
exports.GlobalPOISchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    category: exports.PoiCategorySchema,
    city: zod_1.z.string(),
    address: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
    website: zod_1.z.string().url().optional(),
    googleMapsUrl: zod_1.z.string().url().optional(),
    description: zod_1.z.string().optional(),
    advisorNotes: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
// Reference to a Global POI within a trip, with trip-specific notes
exports.TripPOIReferenceSchema = zod_1.z.object({
    poiId: zod_1.z.string(),
    tripAdvisorNotes: zod_1.z.string().optional(),
    addedAt: zod_1.z.string(),
});
// POI assigned to a specific day/time in an itinerary (snapshot pattern)
exports.PoiAssignmentSchema = zod_1.z.object({
    type: zod_1.z.literal('poi-assignment'),
    id: zod_1.z.string(),
    poiSnapshot: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        category: exports.PoiCategorySchema,
        city: zod_1.z.string(),
        address: zod_1.z.string().optional(),
        lat: zod_1.z.number().optional(),
        lng: zod_1.z.number().optional(),
        website: zod_1.z.string().url().optional(),
        googleMapsUrl: zod_1.z.string().url().optional(),
        description: zod_1.z.string().optional(),
        advisorNotes: zod_1.z.string().optional(),
        tripAdvisorNotes: zod_1.z.string().optional(),
        clientNotes: zod_1.z.string().optional(),
    }),
    dayNumber: zod_1.z.number(),
    startTime: zod_1.z.string().optional(),
    endTime: zod_1.z.string().optional(),
    allDay: zod_1.z.boolean().default(false),
    assignedAt: zod_1.z.string(),
});
// Legacy schema - keep for backward compatibility during migration
exports.PlaceOfInterestSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    category: exports.PoiCategorySchema,
    city: zod_1.z.string(),
    address: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
    website: zod_1.z.string().url().optional(),
    googleMapsUrl: zod_1.z.string().url().optional(),
    description: zod_1.z.string().optional(),
    advisorNotes: zod_1.z.string().optional(),
});
exports.TransportLegSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(['flight', 'train', 'ferry', 'bus', 'other']),
    title: zod_1.z.string(),
    status: exports.ItemStatusSchema,
    // Departure
    departureDate: zod_1.z.string(), // YYYY-MM-DD
    departureTime: zod_1.z.string().optional(), // HH:MM (may be empty for pending bookings)
    departureTimezone: zod_1.z.string(), // IANA e.g. "Europe/Paris"
    departureLocation: zod_1.z.string().optional(),
    departureLat: zod_1.z.number().optional(),
    departureLng: zod_1.z.number().optional(),
    // Arrival
    arrivalDate: zod_1.z.string(), // YYYY-MM-DD (explicit — handles overnight)
    arrivalTime: zod_1.z.string().optional(), // HH:MM (may be empty for pending bookings)
    arrivalTimezone: zod_1.z.string(), // IANA e.g. "Europe/Rome"
    arrivalLocation: zod_1.z.string().optional(),
    arrivalLat: zod_1.z.number().optional(),
    arrivalLng: zod_1.z.number().optional(),
    // Shared
    vendor: zod_1.z.string().optional(),
    confirmationNumber: zod_1.z.string().optional(),
    seat: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    cost: zod_1.z.number().nonnegative().optional(),
    costCurrency: zod_1.z.string().length(3).default('USD').optional(),
});
exports.RentalCarReservationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    status: exports.ItemStatusSchema,
    // Pickup
    pickupDate: zod_1.z.string(), // YYYY-MM-DD
    pickupTime: zod_1.z.string().optional(), // HH:MM (may be empty for pending bookings)
    pickupTimezone: zod_1.z.string(), // IANA e.g. "America/New_York"
    pickupLocation: zod_1.z.string().optional(),
    pickupLat: zod_1.z.number().optional(),
    pickupLng: zod_1.z.number().optional(),
    // Dropoff
    dropoffDate: zod_1.z.string(), // YYYY-MM-DD
    dropoffTime: zod_1.z.string().optional(), // HH:MM (may be empty for pending bookings)
    dropoffTimezone: zod_1.z.string(), // IANA
    dropoffLocation: zod_1.z.string().optional(),
    dropoffLat: zod_1.z.number().optional(),
    dropoffLng: zod_1.z.number().optional(),
    // Rental details
    carClass: zod_1.z.string().optional(), // e.g. "Economy", "SUV", "Compact"
    vendor: zod_1.z.string().optional(),
    confirmationNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    cost: zod_1.z.number().nonnegative().optional(),
    costCurrency: zod_1.z.string().length(3).default('USD').optional(),
});
// Base trip item for regular itinerary items
exports.TripItemBaseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: exports.ItemTypeSchema,
    title: zod_1.z.string(),
    status: exports.ItemStatusSchema,
    startTime: zod_1.z.string().optional(),
    endTime: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
    vendor: zod_1.z.string().optional(),
    confirmationNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    cost: zod_1.z.number().nonnegative().optional(),
    costCurrency: zod_1.z.string().length(3).default('USD').optional(),
});
// Discriminated union for day items (regular items + POI assignments)
exports.DayItemSchema = zod_1.z.discriminatedUnion('type', [
    exports.TripItemBaseSchema,
    exports.PoiAssignmentSchema,
]);
exports.DaySchema = zod_1.z.object({
    date: zod_1.z.string(), // ISO date string YYYY-MM-DD
    dayNumber: zod_1.z.number().int().positive(),
    title: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.DayItemSchema),
});
exports.MapConfigSchema = zod_1.z.object({
    centerLat: zod_1.z.number().optional(),
    centerLng: zod_1.z.number().optional(),
    zoom: zod_1.z.number().optional(),
}).optional();
exports.ItinerarySchema = zod_1.z.object({
    id: zod_1.z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
    title: zod_1.z.string(),
    startDate: zod_1.z.string(), // YYYY-MM-DD
    endDate: zod_1.z.string(), // YYYY-MM-DD
    timezone: zod_1.z.string(), // IANA timezone, e.g. "Europe/Rome"
    summary: zod_1.z.string().optional(),
    travelers: zod_1.z.array(zod_1.z.string()).optional(),
    destinations: zod_1.z.array(zod_1.z.string()),
    days: zod_1.z.array(exports.DaySchema),
    notes: zod_1.z.string().optional(),
    stays: zod_1.z.array(exports.HotelStaySchema).optional().default([]),
    transportLegs: zod_1.z.array(exports.TransportLegSchema).optional().default([]),
    rentalCars: zod_1.z.array(exports.RentalCarReservationSchema).optional().default([]),
    // Legacy field - will be removed after migration
    pois: zod_1.z.array(exports.PlaceOfInterestSchema).optional().default([]),
    // New field - references to Global POIs
    poiReferences: zod_1.z.array(exports.TripPOIReferenceSchema).optional().default([]),
    pinSalt: zod_1.z.string(),
    pinHash: zod_1.z.string(),
    updatedAt: zod_1.z.string(), // ISO datetime
    map: exports.MapConfigSchema,
    baseCurrency: zod_1.z.string().length(3).default('USD').optional(),
});
