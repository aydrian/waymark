import { z } from 'zod';

export const ItemTypeSchema = z.enum([
  'hotel', 'transport', 'activity', 'note', 'restaurant', 'transfer',
]);

export const ItemStatusSchema = z.enum([
  'booked', 'quoted', 'pending', 'canceled',
]);

export const HotelStaySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ItemStatusSchema,
  checkinDate: z.string(),              // YYYY-MM-DD
  checkinTime: z.string().optional(),   // HH:MM
  checkoutDate: z.string(),             // YYYY-MM-DD
  checkoutTime: z.string().optional(),  // HH:MM
  location: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  googleMapsUrl: z.string().url().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  costCurrency: z.string().length(3).default('USD').optional(),
});

export const PoiCategorySchema = z.enum([
  'restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other',
]);

export const PlaceOfInterestSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: PoiCategorySchema,
  city: z.string(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  website: z.string().url().optional(),
  googleMapsUrl: z.string().url().optional(),
  description: z.string().optional(),
  advisorNotes: z.string().optional(),
});

export const TransportLegSchema = z.object({
  id: z.string(),
  type: z.enum(['flight', 'train', 'ferry', 'bus', 'other']),
  title: z.string(),
  status: ItemStatusSchema,
  // Departure
  departureDate: z.string(),                    // YYYY-MM-DD
  departureTime: z.string().optional(),           // HH:MM (may be empty for pending bookings)
  departureTimezone: z.string(),                // IANA e.g. "Europe/Paris"
  departureLocation: z.string().optional(),
  departureLat: z.number().optional(),
  departureLng: z.number().optional(),
  // Arrival
  arrivalDate: z.string(),                      // YYYY-MM-DD (explicit — handles overnight)
  arrivalTime: z.string().optional(),             // HH:MM (may be empty for pending bookings)
  arrivalTimezone: z.string(),                  // IANA e.g. "Europe/Rome"
  arrivalLocation: z.string().optional(),
  arrivalLat: z.number().optional(),
  arrivalLng: z.number().optional(),
  // Shared
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  seat: z.string().optional(),
  notes: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  costCurrency: z.string().length(3).default('USD').optional(),
});

export const RentalCarReservationSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ItemStatusSchema,
  // Pickup
  pickupDate: z.string(),           // YYYY-MM-DD
  pickupTime: z.string().optional(), // HH:MM (may be empty for pending bookings)
  pickupTimezone: z.string(),       // IANA e.g. "America/New_York"
  pickupLocation: z.string().optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  // Dropoff
  dropoffDate: z.string(),          // YYYY-MM-DD
  dropoffTime: z.string().optional(), // HH:MM (may be empty for pending bookings)
  dropoffTimezone: z.string(),      // IANA
  dropoffLocation: z.string().optional(),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  // Rental details
  carClass: z.string().optional(),  // e.g. "Economy", "SUV", "Compact"
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  costCurrency: z.string().length(3).default('USD').optional(),
});

export const TripItemSchema = z.object({
  id: z.string(),
  type: ItemTypeSchema,
  title: z.string(),
  status: ItemStatusSchema,
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  vendor: z.string().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  costCurrency: z.string().length(3).default('USD').optional(),
});

export const DaySchema = z.object({
  date: z.string(), // ISO date string YYYY-MM-DD
  dayNumber: z.number().int().positive(),
  title: z.string(),
  notes: z.string().optional(),
  items: z.array(TripItemSchema),
});

export const MapConfigSchema = z.object({
  centerLat: z.number().optional(),
  centerLng: z.number().optional(),
  zoom: z.number().optional(),
}).optional();

export const ItinerarySchema = z.object({
  id: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
  title: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
  timezone: z.string(),  // IANA timezone, e.g. "Europe/Rome"
  summary: z.string().optional(),
  travelers: z.array(z.string()).optional(),
  destinations: z.array(z.string()),
  days: z.array(DaySchema),
  notes: z.string().optional(),
  stays: z.array(HotelStaySchema).optional().default([]),
  transportLegs: z.array(TransportLegSchema).optional().default([]),
  rentalCars: z.array(RentalCarReservationSchema).optional().default([]),
  pois: z.array(PlaceOfInterestSchema).optional().default([]),
  pinSalt: z.string(),
  pinHash: z.string(),
  updatedAt: z.string(), // ISO datetime
  map: MapConfigSchema,
  baseCurrency: z.string().length(3).default('USD').optional(),
});

// TypeScript types derived from schemas
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type HotelStay = z.infer<typeof HotelStaySchema>;
export type TransportLeg = z.infer<typeof TransportLegSchema>;
export type RentalCarReservation = z.infer<typeof RentalCarReservationSchema>;
export type PoiCategory = z.infer<typeof PoiCategorySchema>;
export type PlaceOfInterest = z.infer<typeof PlaceOfInterestSchema>;
export type TripItem = z.infer<typeof TripItemSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;

export type TripSummary = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  destinations: string[];
  travelers: string[];
  updatedAt: string;
};
