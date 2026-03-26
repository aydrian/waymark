import { z } from 'zod';

export const ItemTypeSchema = z.enum([
  'hotel', 'transport', 'activity', 'note', 'restaurant', 'transfer',
]);

export const ItemStatusSchema = z.enum([
  'booked', 'quoted', 'pending', 'canceled',
]);

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
  summary: z.string().optional(),
  destinations: z.array(z.string()),
  days: z.array(DaySchema),
  notes: z.string().optional(),
  pinSalt: z.string(),
  pinHash: z.string(),
  updatedAt: z.string(), // ISO datetime
  map: MapConfigSchema,
});

// TypeScript types derived from schemas
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type TripItem = z.infer<typeof TripItemSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
