import {
  getGlobalPOI,
  putGlobalPOI,
  deleteGlobalPOI,
  listGlobalPOIs,
} from '@waymark/shared/lib';
import {
  GlobalPOISchema,
  PoiCategorySchema,
  type GlobalPOI,
} from '@waymark/shared/types';
import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Tool definitions
export const poiTools: Tool[] = [
  {
    name: 'list_pois',
    description: 'Get a list of all global POIs (Points of Interest)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_poi',
    description: 'Get details of a specific POI by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'POI UUID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_poi',
    description: 'Create a new global POI that can be used across multiple trips',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'POI name' },
        category: {
          type: 'string',
          enum: ['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other'],
          description: 'Category of the POI',
        },
        city: { type: 'string', description: 'City where the POI is located' },
        address: { type: 'string', description: 'Optional street address' },
        lat: { type: 'number', description: 'Optional latitude' },
        lng: { type: 'number', description: 'Optional longitude' },
        website: { type: 'string', description: 'Optional website URL' },
        googleMapsUrl: { type: 'string', description: 'Optional Google Maps URL' },
        description: { type: 'string', description: 'Optional description' },
        advisorNotes: { type: 'string', description: 'Optional internal notes for advisors' },
      },
      required: ['name', 'category', 'city'],
    },
  },
  {
    name: 'update_poi',
    description: 'Update an existing POI. Only provide fields that need to change.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'POI UUID' },
        name: { type: 'string', description: 'POI name' },
        category: {
          type: 'string',
          enum: ['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other'],
          description: 'Category of the POI',
        },
        city: { type: 'string', description: 'City where the POI is located' },
        address: { type: 'string', description: 'Street address' },
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
        website: { type: 'string', description: 'Website URL' },
        googleMapsUrl: { type: 'string', description: 'Google Maps URL' },
        description: { type: 'string', description: 'Description' },
        advisorNotes: { type: 'string', description: 'Internal notes for advisors' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_poi',
    description: 'Delete a POI by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'POI UUID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_pois',
    description: 'Search POIs by city, category, or name',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Filter by city name (optional)' },
        category: {
          type: 'string',
          enum: ['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other'],
          description: 'Filter by category (optional)',
        },
        name: { type: 'string', description: 'Search by name substring (optional)' },
      },
    },
  },
];

// Input schemas for validation
const GetPOISchema = z.object({
  id: z.string().uuid(),
});

const CreatePOISchema = GlobalPOISchema.omit({ id: true, createdAt: true, updatedAt: true });

const UpdatePOISchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  category: PoiCategorySchema.optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  website: z.string().url().optional(),
  googleMapsUrl: z.string().url().optional(),
  description: z.string().optional(),
  advisorNotes: z.string().optional(),
});

const DeletePOISchema = z.object({
  id: z.string().uuid(),
});

const SearchPOIsSchema = z.object({
  city: z.string().optional(),
  category: PoiCategorySchema.optional(),
  name: z.string().optional(),
});

/**
 * Handle POI-related tool calls
 */
export async function handlePoiTool(
  name: string,
  args: unknown,
  kv: KVNamespace
): Promise<{ content: { type: string; text: string }[]; isError?: boolean } | undefined> {
  switch (name) {
    case 'list_pois': {
      const pois = await listGlobalPOIs(kv);
      // Sort by name for consistent ordering
      pois.sort((a, b) => a.name.localeCompare(b.name));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(pois, null, 2),
          },
        ],
      };
    }

    case 'get_poi': {
      const result = GetPOISchema.safeParse(args);
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

      const poi = await getGlobalPOI(kv, result.data.id);
      if (!poi) {
        return {
          content: [
            {
              type: 'text',
              text: `POI not found: ${result.data.id}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(poi, null, 2),
          },
        ],
      };
    }

    case 'create_poi': {
      const result = CreatePOISchema.safeParse(args);
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

      const now = new Date().toISOString();
      const poi: GlobalPOI = {
        ...result.data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      await putGlobalPOI(kv, poi);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(poi, null, 2),
          },
        ],
      };
    }

    case 'update_poi': {
      const result = UpdatePOISchema.safeParse(args);
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

      const existing = await getGlobalPOI(kv, result.data.id);
      if (!existing) {
        return {
          content: [
            {
              type: 'text',
              text: `POI not found: ${result.data.id}`,
            },
          ],
          isError: true,
        };
      }

      const now = new Date().toISOString();
      const poi: GlobalPOI = {
        ...existing,
        ...result.data,
        updatedAt: now,
      };

      await putGlobalPOI(kv, poi);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(poi, null, 2),
          },
        ],
      };
    }

    case 'delete_poi': {
      const result = DeletePOISchema.safeParse(args);
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

      const deleted = await deleteGlobalPOI(kv, result.data.id);
      if (!deleted) {
        return {
          content: [
            {
              type: 'text',
              text: `POI not found: ${result.data.id}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, deleted: true }, null, 2),
          },
        ],
      };
    }

    case 'search_pois': {
      const result = SearchPOIsSchema.safeParse(args);
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

      const allPois = await listGlobalPOIs(kv);
      let filtered = allPois;

      if (result.data.city) {
        const cityLower = result.data.city.toLowerCase();
        filtered = filtered.filter(p => p.city.toLowerCase().includes(cityLower));
      }

      if (result.data.category) {
        filtered = filtered.filter(p => p.category === result.data.category);
      }

      if (result.data.name) {
        const nameLower = result.data.name.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(nameLower));
      }

      // Sort by name
      filtered.sort((a, b) => a.name.localeCompare(b.name));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pois: filtered, count: filtered.length }, null, 2),
          },
        ],
      };
    }

    default:
      return undefined;
  }
}

// Placeholder for register function
export function registerPoiTools(): void {
  // Tools are registered centrally in server.ts
}
