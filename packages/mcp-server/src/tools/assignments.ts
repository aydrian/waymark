import {
  getTrip,
  putTrip,
  getGlobalPOI,
} from '@waymark/shared/lib';
import {
  PoiAssignmentSchema,
  type PoiAssignment,
} from '@waymark/shared/types';
import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Tool definitions
export const assignmentTools: Tool[] = [
  {
    name: 'list_assignments',
    description: 'List all POI assignments for a trip, optionally filtered by day number',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: '8-character alphanumeric trip ID',
        },
        dayNumber: {
          type: 'number',
          description: 'Optional day number to filter by',
        },
      },
      required: ['tripId'],
    },
  },
  {
    name: 'create_assignment',
    description: 'Assign a POI to a specific day in a trip itinerary',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: '8-character alphanumeric trip ID',
        },
        poiId: {
          type: 'string',
          description: 'UUID of the global POI to assign',
        },
        dayNumber: {
          type: 'number',
          description: 'Day number in the trip (1-based)',
        },
        startTime: {
          type: 'string',
          description: 'Optional start time (HH:MM format)',
        },
        endTime: {
          type: 'string',
          description: 'Optional end time (HH:MM format)',
        },
        allDay: {
          type: 'boolean',
          description: 'Whether this is an all-day assignment',
          default: false,
        },
        clientNotes: {
          type: 'string',
          description: 'Optional notes for the client about this assignment',
        },
      },
      required: ['tripId', 'poiId', 'dayNumber'],
    },
  },
  {
    name: 'update_assignment',
    description: 'Update an existing POI assignment (time, day, or notes)',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: '8-character alphanumeric trip ID',
        },
        assignmentId: {
          type: 'string',
          description: 'UUID of the assignment to update',
        },
        dayNumber: {
          type: 'number',
          description: 'New day number (optional)',
        },
        startTime: {
          type: 'string',
          description: 'New start time (HH:MM) (optional)',
        },
        endTime: {
          type: 'string',
          description: 'New end time (HH:MM) (optional)',
        },
        allDay: {
          type: 'boolean',
          description: 'Set as all-day assignment (optional)',
        },
        clientNotes: {
          type: 'string',
          description: 'New client notes (optional)',
        },
      },
      required: ['tripId', 'assignmentId'],
    },
  },
  {
    name: 'delete_assignment',
    description: 'Remove a POI assignment from a trip itinerary',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: '8-character alphanumeric trip ID',
        },
        assignmentId: {
          type: 'string',
          description: 'UUID of the assignment to delete',
        },
      },
      required: ['tripId', 'assignmentId'],
    },
  },
];

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
 * Handle assignment-related tool calls
 */
export async function handleAssignmentTool(
  name: string,
  args: unknown,
  kv: KVNamespace
): Promise<{ content: { type: string; text: string }[]; isError?: boolean } | undefined> {
  switch (name) {
    case 'list_assignments': {
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

      const trip = await getTrip(kv, result.data.tripId);
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

    case 'create_assignment': {
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

      const trip = await getTrip(kv, tripId);
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
      const globalPOI = await getGlobalPOI(kv, poiId);
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

      await putTrip(kv, updatedTrip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(assignment, null, 2),
          },
        ],
      };
    }

    case 'update_assignment': {
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

      const trip = await getTrip(kv, tripId);
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

      await putTrip(kv, updatedTrip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updatedAssignment, null, 2),
          },
        ],
      };
    }

    case 'delete_assignment': {
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

      const trip = await getTrip(kv, tripId);
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

      await putTrip(kv, updatedTrip);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true }, null, 2),
          },
        ],
      };
    }

    default:
      return undefined;
  }
}

// Placeholder for register function
export function registerAssignmentTools(): void {
  // Tools are registered centrally in server.ts
}
