import { hashPin, generateSalt } from '@itsaydrian/waymark-shared/lib';
import {
  ItinerarySchema,
  type Itinerary,
} from '@itsaydrian/waymark-shared/types';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WaymarkBackend } from '../backends/types.js';

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
 * Register all trip-related tools with the MCP server
 */
export function registerTripTools(server: McpServer, createBackend: () => WaymarkBackend): void {
  // list_trips - no parameters
  server.registerTool(
    'list_trips',
    {
      description: 'Get a summary list of all trips in the system',
    },
    async () => {
      const backend = createBackend();
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
  );

  // get_trip
  server.registerTool(
    'get_trip',
    {
      description: 'Get full details of a trip by its ID',
      inputSchema: {
        id: z.string().regex(/^[a-z0-9]{8}$/).describe('8-character alphanumeric trip ID (e.g., a8k3m2q9)'),
      },
    },
    async ({ id }) => {
      const backend = createBackend();
      const trip = await backend.getTrip(id);
      if (!trip) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${id}`,
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
  );

  // create_trip
  server.registerTool(
    'create_trip',
    {
      description: 'Create a new itinerary. If a plain `pin` field is provided, it will be hashed automatically.',
      inputSchema: {
        id: z.string().describe('8-character alphanumeric trip ID'),
        title: z.string().describe('Trip title'),
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().describe('IANA timezone (e.g., Europe/Rome)'),
        destinations: z.array(z.string()).describe('List of destinations'),
        summary: z.string().optional().describe('Optional trip summary'),
        travelers: z.array(z.string()).optional().describe('Optional list of traveler names'),
        pin: z.string().optional().describe('Plain PIN to be hashed (alternative to pinSalt/pinHash)'),
        pinSalt: z.string().optional().describe('Pre-generated PIN salt'),
        pinHash: z.string().optional().describe('Pre-computed PIN hash'),
        days: z.array(z.any()).describe('Trip days structure'),
        notes: z.string().optional().describe('Optional trip-level notes'),
        stays: z.array(z.any()).optional().describe('Optional hotel stays'),
        transportLegs: z.array(z.any()).optional().describe('Optional transport legs'),
        rentalCars: z.array(z.any()).optional().describe('Optional rental car reservations'),
        map: z.object({
          centerLat: z.number(),
          centerLng: z.number(),
          zoom: z.number(),
        }).optional().describe('Optional map configuration'),
        baseCurrency: z.string().default('USD').describe('Base currency code (3 letters)'),
      },
    },
    async (args) => {
      const backend = createBackend();
      let body: Record<string, unknown> = { ...args };

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
  );

  // update_trip
  server.registerTool(
    'update_trip',
    {
      description: 'Update an existing trip. Provide the complete trip object with all fields.',
      inputSchema: {
        id: z.string().describe('8-character alphanumeric trip ID'),
        title: z.string().describe('Trip title'),
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        timezone: z.string().describe('IANA timezone'),
        destinations: z.array(z.string()).describe('List of destinations'),
        summary: z.string().optional().describe('Trip summary'),
        travelers: z.array(z.string()).optional().describe('List of traveler names'),
        pinSalt: z.string().describe('PIN salt'),
        pinHash: z.string().describe('PIN hash'),
        days: z.array(z.any()).describe('Complete days array'),
        notes: z.string().optional().describe('Trip notes'),
        stays: z.array(z.any()).optional().describe('Hotel stays'),
        transportLegs: z.array(z.any()).optional().describe('Transport legs'),
        rentalCars: z.array(z.any()).optional().describe('Rental car reservations'),
        poiReferences: z.array(z.any()).optional().describe('POI references'),
        map: z.any().optional().describe('Map configuration'),
        updatedAt: z.string().describe('Last update timestamp (ISO)'),
        baseCurrency: z.string().optional().describe('Base currency code'),
      },
    },
    async (args) => {
      const backend = createBackend();
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
  );

  // delete_trip
  server.registerTool(
    'delete_trip',
    {
      description: 'Delete a trip by its ID',
      inputSchema: {
        id: z.string().regex(/^[a-z0-9]{8}$/).describe('8-character alphanumeric trip ID'),
      },
    },
    async ({ id }) => {
      const backend = createBackend();
      const deleted = await backend.deleteTrip(id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, deleted }, null, 2),
          },
        ],
      };
    }
  );
}
