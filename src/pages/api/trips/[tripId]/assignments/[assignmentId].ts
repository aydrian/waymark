import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyTripAccess } from '../../../../../lib/cookie.js';
import { getTrip, putTrip } from '../../../../../lib/kv.js';
import { PoiAssignmentSchema } from '../../../../../types/itinerary.js';
import { z } from 'zod';

const UpdateAssignmentSchema = z.object({
  dayNumber: z.number().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean().optional(),
  clientNotes: z.string().optional(),
});

// PUT /api/trips/[tripId]/assignments/[assignmentId] - Update assignment
export const PUT: APIRoute = async ({ params, request }) => {
  const { tripId, assignmentId } = params as { tripId: string; assignmentId: string };
  if (!tripId || !assignmentId) {
    return new Response(JSON.stringify({ error: 'Missing tripId or assignmentId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authorized = await verifyTripAccess(request, tripId, env.COOKIE_SIGNING_SECRET);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, tripId);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find the assignment in any day
  let foundDayIndex = -1;
  let foundItemIndex = -1;
  let foundAssignment: z.infer<typeof PoiAssignmentSchema> | null = null;

  for (let i = 0; i < trip.days.length; i++) {
    const itemIndex = trip.days[i].items.findIndex(
      item => item.type === 'poi-assignment' && item.id === assignmentId
    );
    if (itemIndex !== -1) {
      foundDayIndex = i;
      foundItemIndex = itemIndex;
      foundAssignment = trip.days[i].items[itemIndex] as z.infer<typeof PoiAssignmentSchema>;
      break;
    }
  }

  if (!foundAssignment) {
    return new Response(JSON.stringify({ error: 'Assignment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = UpdateAssignmentSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { dayNumber, startTime, endTime, allDay, clientNotes } = result.data;

  // If moving to a different day, verify it exists
  if (dayNumber !== undefined && dayNumber !== foundAssignment.dayNumber) {
    const newDay = trip.days.find(d => d.dayNumber === dayNumber);
    if (!newDay) {
      return new Response(JSON.stringify({ error: 'Target day not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const updatedAssignment: z.infer<typeof PoiAssignmentSchema> = {
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

  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(updatedAssignment), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE /api/trips/[tripId]/assignments/[assignmentId] - Remove assignment
export const DELETE: APIRoute = async ({ params, request }) => {
  const { tripId, assignmentId } = params as { tripId: string; assignmentId: string };
  if (!tripId || !assignmentId) {
    return new Response(JSON.stringify({ error: 'Missing tripId or assignmentId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authorized = await verifyTripAccess(request, tripId, env.COOKIE_SIGNING_SECRET);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, tripId);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
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
    return new Response(JSON.stringify({ error: 'Assignment not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedTrip = {
    ...trip,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  };

  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
