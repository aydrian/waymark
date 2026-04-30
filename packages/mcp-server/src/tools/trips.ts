import {
  hashPin,
  generateSalt,
} from '@itsaydrian/waymark-shared/lib';
import {
  ItinerarySchema,
  type Itinerary,
} from '@itsaydrian/waymark-shared/types';
import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WaymarkBackend } from '../backends/types.js';

// Tool definitions
export const tripTools: Tool[] = [
  {
    name: 'list_trips',
    description: 'Get a summary list of all trips in the system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_trip',
    description: 'Get full details of a trip by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '8-character alphanumeric trip ID (e.g., a8k3m2q9)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_trip',
    description: 'Create a new itinerary. If a plain `pin` field is provided, it will be hashed automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '8-character alphanumeric trip ID' },
        title: { type: 'string', description: 'Trip title' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        timezone: { type: 'string', description: 'IANA timezone (e.g., Europe/Rome)' },
        destinations: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of destinations',
        },
        summary: { type: 'string', description: 'Optional trip summary' },
        travelers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of traveler names',
        },
        pin: { type: 'string', description: 'Plain PIN to be hashed (alternative to pinSalt/pinHash)' },
        pinSalt: { type: 'string', description: 'Pre-generated PIN salt' },
        pinHash: { type: 'string', description: 'Pre-computed PIN hash' },
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
              dayNumber: { type: 'number', description: 'Day number in trip' },
              title: { type: 'string', description: 'Day title' },
              notes: { type: 'string', description: 'Optional notes' },
              items: { type: 'array', description: 'Day items (can be empty)' },
            },
            required: ['date', 'dayNumber', 'title', 'items'],
          },
          description: 'Trip days structure',
        },
        notes: { type: 'string', description: 'Optional trip-level notes' },
        stays: { type: 'array', description: 'Optional hotel stays' },
        transportLegs: { type: 'array', description: 'Optional transport legs' },
        rentalCars: { type: 'array', description: 'Optional rental car reservations' },
        map: {
          type: 'object',
          properties: {
            centerLat: { type: 'number' },
            centerLng: { type: 'number' },
            zoom: { type: 'number' },
          },
          description: 'Optional map configuration',
        },
        baseCurrency: { type: 'string', description: 'Base currency code (3 letters)', default: 'USD' },
      },
      required: ['id', 'title', 'startDate', 'endDate', 'timezone', 'destinations', 'days'],
    },
  },
  {
    name: 'update_trip',
    description: 'Update an existing trip. Provide the complete trip object with all fields.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '8-character alphanumeric trip ID' },
        title: { type: 'string', description: 'Trip title' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        timezone: { type: 'string', description: 'IANA timezone' },
        destinations: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of destinations',
        },
        summary: { type: 'string', description: 'Trip summary' },
        travelers: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of traveler names',
        },
        pinSalt: { type: 'string', description: 'PIN salt' },
        pinHash: { type: 'string', description: 'PIN hash' },
        days: {
          type: 'array',
          items: { type: 'object' },
          description: 'Complete days array',
        },
        notes: { type: 'string', description: 'Trip notes' },
        stays: { type: 'array', description: 'Hotel stays' },
        transportLegs: { type: 'array', description: 'Transport legs' },
        rentalCars: { type: 'array', description: 'Rental car reservations' },
        poiReferences: { type: 'array', description: 'POI references' },
        map: { type: 'object', description: 'Map configuration' },
        updatedAt: { type: 'string', description: 'Last update timestamp (ISO)' },
        baseCurrency: { type: 'string', description: 'Base currency code' },
      },
      required: ['id', 'title', 'startDate', 'endDate', 'timezone', 'destinations', 'pinSalt', 'pinHash', 'days', 'updatedAt'],
    },
  },
  {
    name: 'delete_trip',
    description: 'Delete a trip by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '8-character alphanumeric trip ID',
        },
      },
      required: ['id'],
    },
  },
];

// Input schemas for validation
const GetTripSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
});

const CreateTripSchema = ItinerarySchema.omit({ pinSalt: true, pinHash: true, updatedAt: true }).extend({
  pin: z.string().optional(),
  pinSalt: z.string().optional(),
  pinHash: z.string().optional(),
});

const DeleteTripSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
});

/**
 * Handle trip-related tool calls
 */
export async function handleTripTool(
  name: string,
  args: unknown,
  backend: WaymarkBackend
): Promise<{ content: { type: string; text: string }[]; isError?: boolean } | undefined> {
  switch (name) {
    case 'list_trips': {
      const trips = await backend.listTrips();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ trips, count: trips.length }, null, 2),
          },
        ],
      };
    }

    case 'get_trip': {
      const result = GetTripSchema.safeParse(args);
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${JSON.stringify(result.error.issues, null, 2)}`,
            },
          ],
          isError: true,
        };
      }

      const trip = await backend.getTrip(result.data.id);
      if (!trip) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${result.data.id}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(trip, null, 2),
          },
        ],
      };
    }

    case 'create_trip': {
      let body = args as Record<string, unknown>;

      // Handle plain PIN hashing if provided
      if (body?.pin && typeof body.pin === 'string' && body.pin.length > 0) {
        const salt = generateSalt();
        const hash = await hashPin(body.pin, salt);
        body = {
          ...body,
          pinSalt: salt,
          pinHash: hash,
        };
        delete body.pin;
      }

      const result = CreateTripSchema.safeParse(body);
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${JSON.stringify(result.error.issues, null, 2)}`,
            },
          ],
          isError: true,
        };
      }

      // Generate updatedAt and construct full itinerary
      const now = new Date().toISOString();
      const trip: Itinerary = {
        ...result.data,
        pinSalt: (body.pinSalt as string) || generateSalt(),
        pinHash: (body.pinHash as string) || '',
        updatedAt: now,
      };

      await backend.putTrip(trip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, id: trip.id, updatedAt: trip.updatedAt }, null, 2),
          },
        ],
      };
    }

    case 'update_trip': {
      const result = ItinerarySchema.safeParse(args);
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${JSON.stringify(result.error.issues, null, 2)}`,
            },
          ],
          isError: true,
        };
      }

      // Check trip exists
      const existing = await backend.getTrip(result.data.id);
      if (!existing) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${result.data.id}`,
            },
          ],
          isError: true,
        };
      }

      await backend.putTrip(result.data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, id: result.data.id, updatedAt: result.data.updatedAt }, null, 2),
          },
        ],
      };
    }

    case 'delete_trip': {
      const result = DeleteTripSchema.safeParse(args);
      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation error: ${JSON.stringify(result.error.issues, null, 2)}`,
            },
          ],
          isError: true,
        };
      }

      const deleted = await backend.deleteTrip(result.data.id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, deleted }, null, 2),
          },
        ],
      };
    }

    default:
      return undefined;
  }
}

// Placeholder for register function (not used in current architecture but exported for compatibility)
export function registerTripTools(): void {
  // Tools are registered centrally in server.ts
}
