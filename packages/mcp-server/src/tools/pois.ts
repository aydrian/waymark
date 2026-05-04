import {
  GlobalPOISchema,
  PoiCategorySchema,
  type GlobalPOI,
} from '@itsaydrian/waymark-shared/types';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WaymarkBackend } from '../backends/types.js';

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
 * Register all POI-related tools with the MCP server
 */
export function registerPoiTools(server: McpServer, createBackend: () => WaymarkBackend): void {
  // list_pois
  server.registerTool(
    'list_pois',
    {
      description: 'Get a list of all global POIs (Points of Interest)',
    },
    async () => {
      const backend = createBackend();
      const pois = await backend.listGlobalPOIs();
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
  );

  // get_poi
  server.registerTool(
    'get_poi',
    {
      description: 'Get details of a specific POI by its ID',
      inputSchema: {
        id: z.string().uuid().describe('POI UUID'),
      },
    },
    async ({ id }) => {
      const backend = createBackend();
      const poi = await backend.getGlobalPOI(id);
      if (!poi) {
        return {
          content: [
            {
              type: 'text',
              text: `POI not found: ${id}`,
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
  );

  // create_poi
  server.registerTool(
    'create_poi',
    {
      description: 'Create a new global POI that can be used across multiple trips',
      inputSchema: {
        name: z.string().describe('POI name'),
        category: z.enum(['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other']).describe('Category of the POI'),
        city: z.string().describe('City where the POI is located'),
        address: z.string().optional().describe('Optional street address'),
        lat: z.number().optional().describe('Optional latitude'),
        lng: z.number().optional().describe('Optional longitude'),
        website: z.string().url().optional().describe('Optional website URL'),
        googleMapsUrl: z.string().url().optional().describe('Optional Google Maps URL'),
        description: z.string().optional().describe('Optional description'),
        advisorNotes: z.string().optional().describe('Optional internal notes for advisors'),
      },
    },
    async (args) => {
      const backend = createBackend();
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

      const poi = await backend.createGlobalPOI(result.data);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(poi, null, 2),
          },
        ],
      };
    }
  );

  // update_poi
  server.registerTool(
    'update_poi',
    {
      description: 'Update an existing POI. Only provide fields that need to change.',
      inputSchema: {
        id: z.string().uuid().describe('POI UUID'),
        name: z.string().optional().describe('POI name'),
        category: z.enum(['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other']).optional().describe('Category of the POI'),
        city: z.string().optional().describe('City where the POI is located'),
        address: z.string().optional().describe('Street address'),
        lat: z.number().optional().describe('Latitude'),
        lng: z.number().optional().describe('Longitude'),
        website: z.string().url().optional().describe('Website URL'),
        googleMapsUrl: z.string().url().optional().describe('Google Maps URL'),
        description: z.string().optional().describe('Description'),
        advisorNotes: z.string().optional().describe('Internal notes for advisors'),
      },
    },
    async (args) => {
      const backend = createBackend();
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

      const existing = await backend.getGlobalPOI(result.data.id);
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

      await backend.putGlobalPOI(poi);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(poi, null, 2),
          },
        ],
      };
    }
  );

  // delete_poi
  server.registerTool(
    'delete_poi',
    {
      description: 'Delete a POI by its ID',
      inputSchema: {
        id: z.string().uuid().describe('POI UUID'),
      },
    },
    async ({ id }) => {
      const backend = createBackend();
      const deleted = await backend.deleteGlobalPOI(id);
      if (!deleted) {
        return {
          content: [
            {
              type: 'text',
              text: `POI not found: ${id}`,
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
  );

  // search_pois
  server.registerTool(
    'search_pois',
    {
      description: 'Search POIs by city, category, or name',
      inputSchema: {
        city: z.string().optional().describe('Filter by city name (optional)'),
        category: z.enum(['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other']).optional().describe('Filter by category (optional)'),
        name: z.string().optional().describe('Search by name substring (optional)'),
      },
    },
    async (args) => {
      const backend = createBackend();
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

      const allPois = await backend.listGlobalPOIs();
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
  );
}
