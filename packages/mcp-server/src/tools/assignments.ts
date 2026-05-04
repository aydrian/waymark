import {
  PoiAssignmentSchema,
  type PoiAssignment,
} from '@itsaydrian/waymark-shared/types';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WaymarkBackend } from '../backends/types.js';

// Input schemas for validation
const ListAssignmentsSchema = z.object({
  tripId: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
  dayNumber: z.number().int().positive().optional(),
});

const CreateAssignmentSchema = z.object({
  tripId: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
  poiId: z.string().uuid(),
  dayNumber: z.number().int().positive(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().default(false),
  clientNotes: z.string().optional(),
});

const UpdateAssignmentSchema = z.object({
  tripId: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
  assignmentId: z.string().uuid(),
  dayNumber: z.number().int().positive().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().optional(),
  clientNotes: z.string().optional(),
});

const DeleteAssignmentSchema = z.object({
  tripId: z.string().regex(/^[a-z0-9]{8}$/, 'id must be 8 lowercase alphanumeric chars'),
  assignmentId: z.string().uuid(),
});

/**
 * Register all assignment-related tools with the MCP server
 */
export function registerAssignmentTools(server: McpServer, createBackend: () => WaymarkBackend): void {
  // list_assignments
  server.registerTool(
    'list_assignments',
    {
      description: 'List all POI assignments for a trip, optionally filtered by day number',
      inputSchema: {
        tripId: z.string().regex(/^[a-z0-9]{8}$/).describe('8-character alphanumeric trip ID'),
        dayNumber: z.number().int().positive().optional().describe('Optional day number to filter by'),
      },
    },
    async (args) => {
      const backend = createBackend();
      const result = ListAssignmentsSchema.safeParse(args);
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

      const trip = await backend.getTrip(result.data.tripId);
      if (!trip) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${result.data.tripId}`,
            },
          ],
          isError: true,
        };
      }

      // Collect all assignments from days
      const assignments: PoiAssignment[] = [];
      for (const day of trip.days) {
        if (result.data.dayNumber && day.dayNumber !== result.data.dayNumber) {
          continue;
        }
        for (const item of day.items) {
          if (item.type === 'poi-assignment') {
            assignments.push(item as PoiAssignment);
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ assignments, count: assignments.length }, null, 2),
          },
        ],
      };
    }
  );

  // create_assignment
  server.registerTool(
    'create_assignment',
    {
      description: 'Assign a POI to a specific day in a trip itinerary',
      inputSchema: {
        tripId: z.string().regex(/^[a-z0-9]{8}$/).describe('8-character alphanumeric trip ID'),
        poiId: z.string().uuid().describe('UUID of the global POI to assign'),
        dayNumber: z.number().int().positive().describe('Day number in the trip (1-based)'),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Optional start time (HH:MM format)'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Optional end time (HH:MM format)'),
        allDay: z.boolean().default(false).describe('Whether this is an all-day assignment'),
        clientNotes: z.string().optional().describe('Optional notes for the client about this assignment'),
      },
    },
    async (args) => {
      const backend = createBackend();
      const result = CreateAssignmentSchema.safeParse(args);
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

      const { tripId, poiId, dayNumber, startTime, endTime, allDay, clientNotes } = result.data;

      const trip = await backend.getTrip(tripId);
      if (!trip) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${tripId}`,
            },
          ],
          isError: true,
        };
      }

      // Verify day exists
      const day = trip.days.find(d => d.dayNumber === dayNumber);
      if (!day) {
        return {
          content: [
            {
              type: 'text',
              text: `Day ${dayNumber} not found in trip`,
            },
          ],
          isError: true,
        };
      }

      // Check if POI exists in trip's poiReferences
      const tripPOIRef = trip.poiReferences?.find(ref => ref.poiId === poiId);

      // Get global POI data
      const globalPOI = await backend.getGlobalPOI(poiId);
      if (!globalPOI) {
        return {
          content: [
            {
              type: 'text',
              text: `Global POI not found: ${poiId}`,
            },
          ],
          isError: true,
        };
      }

      // Create assignment with snapshot
      const assignment: PoiAssignment = {
        type: 'poi-assignment',
        id: crypto.randomUUID(),
        poiSnapshot: {
          id: globalPOI.id,
          name: globalPOI.name,
          category: globalPOI.category,
          city: globalPOI.city,
          address: globalPOI.address,
          lat: globalPOI.lat,
          lng: globalPOI.lng,
          website: globalPOI.website,
          googleMapsUrl: globalPOI.googleMapsUrl,
          description: globalPOI.description,
          advisorNotes: globalPOI.advisorNotes,
          tripAdvisorNotes: tripPOIRef?.tripAdvisorNotes,
          clientNotes,
        },
        dayNumber,
        startTime,
        endTime,
        allDay,
        assignedAt: new Date().toISOString(),
      };

      // Add to day's items
      const updatedDays = trip.days.map(d =>
        d.dayNumber === dayNumber
          ? { ...d, items: [...d.items, assignment] }
          : d
      );

      const updatedTrip = {
        ...trip,
        days: updatedDays,
        updatedAt: new Date().toISOString(),
      };

      await backend.putTrip(updatedTrip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(assignment, null, 2),
          },
        ],
      };
    }
  );

  // update_assignment
  server.registerTool(
    'update_assignment',
    {
      description: 'Update an existing POI assignment (time, day, or notes)',
      inputSchema: {
        tripId: z.string().regex(/^[a-z0-9]{8}$/).describe('8-character alphanumeric trip ID'),
        assignmentId: z.string().uuid().describe('UUID of the assignment to update'),
        dayNumber: z.number().int().positive().optional().describe('New day number (optional)'),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('New start time (HH:MM) (optional)'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('New end time (HH:MM) (optional)'),
        allDay: z.boolean().optional().describe('Set as all-day assignment (optional)'),
        clientNotes: z.string().optional().describe('New client notes (optional)'),
      },
    },
    async (args) => {
      const backend = createBackend();
      const result = UpdateAssignmentSchema.safeParse(args);
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

      const { tripId, assignmentId, dayNumber, startTime, endTime, allDay, clientNotes } = result.data;

      const trip = await backend.getTrip(tripId);
      if (!trip) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${tripId}`,
            },
          ],
          isError: true,
        };
      }

      // Find the assignment in any day
      let foundDayIndex = -1;
      let foundItemIndex = -1;
      let foundAssignment: PoiAssignment | null = null;

      for (let i = 0; i < trip.days.length; i++) {
        const itemIndex = trip.days[i].items.findIndex(
          item => item.type === 'poi-assignment' && item.id === assignmentId
        );
        if (itemIndex !== -1) {
          foundDayIndex = i;
          foundItemIndex = itemIndex;
          foundAssignment = trip.days[i].items[itemIndex] as PoiAssignment;
          break;
        }
      }

      if (!foundAssignment) {
        return {
          content: [
            {
              type: 'text',
              text: `Assignment not found: ${assignmentId}`,
            },
          ],
          isError: true,
        };
      }

      // If moving to a different day, verify it exists
      if (dayNumber !== undefined && dayNumber !== foundAssignment.dayNumber) {
        const newDay = trip.days.find(d => d.dayNumber === dayNumber);
        if (!newDay) {
          return {
            content: [
              {
                type: 'text',
                text: `Target day ${dayNumber} not found`,
              },
            ],
            isError: true,
          };
        }
      }

      // Build updated assignment
      const updatedAssignment: PoiAssignment = {
        ...foundAssignment,
        ...(dayNumber !== undefined && { dayNumber }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(allDay !== undefined && { allDay }),
        ...(clientNotes !== undefined && {
          poiSnapshot: {
            ...foundAssignment.poiSnapshot,
            clientNotes,
          },
        }),
      };

      let updatedDays;

      if (dayNumber !== undefined && dayNumber !== foundAssignment.dayNumber) {
        // Moving to different day - remove from old, add to new
        updatedDays = trip.days.map((d, idx) => {
          if (idx === foundDayIndex) {
            return { ...d, items: d.items.filter((_, i) => i !== foundItemIndex) };
          }
          if (d.dayNumber === dayNumber) {
            return { ...d, items: [...d.items, updatedAssignment] };
          }
          return d;
        });
      } else {
        // Updating in place
        updatedDays = trip.days.map((d, idx) => {
          if (idx === foundDayIndex) {
            return {
              ...d,
              items: d.items.map((item, i) =>
                i === foundItemIndex ? updatedAssignment : item
              ),
            };
          }
          return d;
        });
      }

      const updatedTrip = {
        ...trip,
        days: updatedDays,
        updatedAt: new Date().toISOString(),
      };

      await backend.putTrip(updatedTrip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedAssignment, null, 2),
          },
        ],
      };
    }
  );

  // delete_assignment
  server.registerTool(
    'delete_assignment',
    {
      description: 'Remove a POI assignment from a trip itinerary',
      inputSchema: {
        tripId: z.string().regex(/^[a-z0-9]{8}$/).describe('8-character alphanumeric trip ID'),
        assignmentId: z.string().uuid().describe('UUID of the assignment to delete'),
      },
    },
    async (args) => {
      const backend = createBackend();
      const result = DeleteAssignmentSchema.safeParse(args);
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

      const { tripId, assignmentId } = result.data;

      const trip = await backend.getTrip(tripId);
      if (!trip) {
        return {
          content: [
            {
              type: 'text',
              text: `Trip not found: ${tripId}`,
            },
          ],
          isError: true,
        };
      }

      // Find and remove the assignment
      let found = false;
      const updatedDays = trip.days.map(d => {
        const itemIndex = d.items.findIndex(
          item => item.type === 'poi-assignment' && item.id === assignmentId
        );
        if (itemIndex !== -1) {
          found = true;
          return { ...d, items: d.items.filter((_, i) => i !== itemIndex) };
        }
        return d;
      });

      if (!found) {
        return {
          content: [
            {
              type: 'text',
              text: `Assignment not found: ${assignmentId}`,
            },
          ],
          isError: true,
        };
      }

      const updatedTrip = {
        ...trip,
        days: updatedDays,
        updatedAt: new Date().toISOString(),
      };

      await backend.putTrip(updatedTrip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2),
          },
        ],
      };
    }
  );
}
