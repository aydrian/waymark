import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAssignmentTool, assignmentTools } from '../../tools/assignments.js';
import { createMockBackend } from '../mocks/mock-backend.js';
import type { Itinerary, GlobalPOI, PoiAssignment } from '@itsaydrian/waymark-shared/types';

describe('assignmentTools', () => {
  it('should export 4 assignment tools', () => {
    expect(assignmentTools).toHaveLength(4);
    expect(assignmentTools.map(t => t.name)).toContain('list_assignments');
    expect(assignmentTools.map(t => t.name)).toContain('create_assignment');
    expect(assignmentTools.map(t => t.name)).toContain('update_assignment');
    expect(assignmentTools.map(t => t.name)).toContain('delete_assignment');
  });
});

describe('handleAssignmentTool', () => {
  let backend: ReturnType<typeof createMockBackend>;

  const samplePOI: GlobalPOI = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Eiffel Tower',
    category: 'attraction',
    city: 'Paris',
    address: 'Champ de Mars',
    lat: 48.8584,
    lng: 2.2945,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const sampleAssignment: PoiAssignment = {
    type: 'poi-assignment',
    id: '660e8400-e29b-41d4-a716-446655440000',
    poiSnapshot: {
      id: samplePOI.id,
      name: samplePOI.name,
      category: samplePOI.category,
      city: samplePOI.city,
    },
    dayNumber: 1,
    startTime: '09:00',
    endTime: '11:00',
    allDay: false,
    assignedAt: '2024-01-01T00:00:00Z',
  };

  const sampleTrip: Itinerary = {
    id: 'abc12345',
    title: 'Paris Trip',
    startDate: '2024-06-01',
    endDate: '2024-06-07',
    timezone: 'Europe/Paris',
    destinations: ['Paris'],
    pinSalt: 'salt123',
    pinHash: 'hash456',
    days: [
      {
        date: '2024-06-01',
        dayNumber: 1,
        title: 'Day 1 - Arrival',
        items: [sampleAssignment],
      },
      {
        date: '2024-06-02',
        dayNumber: 2,
        title: 'Day 2 - Exploration',
        items: [],
      },
    ],
    updatedAt: '2024-01-01T00:00:00Z',
    stays: [],
    transportLegs: [],
    rentalCars: [],
    pois: [],
    poiReferences: [],
  };

  beforeEach(() => {
    backend = createMockBackend();
    backend.clear();
    vi.clearAllMocks();
  });

  describe('list_assignments', () => {
    it('should return error for non-existent trip', async () => {
      const result = await handleAssignmentTool('list_assignments', { tripId: 'nonexist' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Trip not found');
    });

    it('should return validation error for invalid tripId', async () => {
      const result = await handleAssignmentTool('list_assignments', { tripId: 'INVALID' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should return all assignments when no day filter', async () => {
      backend.seedTrips([sampleTrip]);
      const result = await handleAssignmentTool('list_assignments', { tripId: 'abc12345' }, backend);

      expect(result?.content[0].text).toContain('"count": 1');
      expect(result?.content[0].text).toContain('Eiffel Tower');
    });

    it('should filter by dayNumber', async () => {
      backend.seedTrips([sampleTrip]);
      const result = await handleAssignmentTool('list_assignments', { tripId: 'abc12345', dayNumber: 2 }, backend);

      expect(result?.content[0].text).toContain('"count": 0');
    });

    it('should only include poi-assignment type items', async () => {
      const tripWithMixedItems: Itinerary = {
        ...sampleTrip,
        days: [
          {
            ...sampleTrip.days[0],
            items: [
              sampleAssignment,
              { type: 'note', title: 'Note', content: 'Some note', status: 'booked', id: 'note-1' } as any,
            ],
          },
        ],
      };
      backend.seedTrips([tripWithMixedItems]);
      const result = await handleAssignmentTool('list_assignments', { tripId: 'abc12345' }, backend);

      expect(result?.content[0].text).toContain('"count": 1');
    });
  });

  describe('create_assignment', () => {
    beforeEach(() => {
      backend.seedTrips([sampleTrip]);
      backend.seedPOIs([samplePOI]);
    });

    it('should create assignment successfully', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: samplePOI.id,
        dayNumber: 2,
        startTime: '14:00',
        endTime: '16:00',
      }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('Eiffel Tower');
      expect(result?.content[0].text).toContain('"dayNumber": 2');
    });

    it('should return error for non-existent trip', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'nonexist',
        poiId: samplePOI.id,
        dayNumber: 1,
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Trip not found');
    });

    it('should return error for non-existent day', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: samplePOI.id,
        dayNumber: 99,
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Day 99 not found');
    });

    it('should return error for non-existent POI', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: '550e8400-e29b-41d4-a716-446655440999',
        dayNumber: 1,
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Global POI not found');
    });

    it('should validate poiId is a valid UUID', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: 'not-a-uuid',
        dayNumber: 1,
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should validate time format', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: samplePOI.id,
        dayNumber: 1,
        startTime: 'invalid',
      }, backend);

      expect(result?.isError).toBe(true);
    });

    it('should include clientNotes in poiSnapshot', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: samplePOI.id,
        dayNumber: 1,
        clientNotes: 'Arrive early to beat crowds',
      }, backend);

      expect(result?.content[0].text).toContain('Arrive early to beat crowds');
    });

    it('should use allDay flag correctly', async () => {
      const result = await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: samplePOI.id,
        dayNumber: 1,
        allDay: true,
      }, backend);

      expect(result?.content[0].text).toContain('"allDay": true');
    });

    it('should call backend.putTrip to save changes', async () => {
      await handleAssignmentTool('create_assignment', {
        tripId: 'abc12345',
        poiId: samplePOI.id,
        dayNumber: 1,
      }, backend);

      expect(backend.calls).toContainEqual({
        method: 'putTrip',
        args: [expect.objectContaining({ id: 'abc12345' })],
      });
    });
  });

  describe('update_assignment', () => {
    beforeEach(() => {
      backend.seedTrips([sampleTrip]);
    });

    it('should update assignment time', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
        startTime: '10:00',
        endTime: '12:00',
      }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"startTime": "10:00"');
    });

    it('should move assignment to different day', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
        dayNumber: 2,
      }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"dayNumber": 2');
    });

    it('should return error for non-existent trip', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'nonexist',
        assignmentId: sampleAssignment.id,
      }, backend);

      expect(result?.isError).toBe(true);
    });

    it('should return error for non-existent assignment', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: '660e8400-e29b-41d4-a716-446655440999',
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Assignment not found');
    });

    it('should return error when target day does not exist', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
        dayNumber: 99,
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Target day 99 not found');
    });

    it('should update clientNotes in poiSnapshot', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
        clientNotes: 'Updated notes',
      }, backend);

      expect(result?.content[0].text).toContain('Updated notes');
    });

    it('should call backend.putTrip to save changes', async () => {
      await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
        startTime: '15:00',
      }, backend);

      expect(backend.calls).toContainEqual({
        method: 'putTrip',
        args: [expect.objectContaining({ id: 'abc12345' })],
      });
    });

    it('should update allDay flag', async () => {
      const result = await handleAssignmentTool('update_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
        allDay: true,
      }, backend);

      expect(result?.content[0].text).toContain('"allDay": true');
    });
  });

  describe('delete_assignment', () => {
    beforeEach(() => {
      backend.seedTrips([sampleTrip]);
    });

    it('should delete assignment successfully', async () => {
      const result = await handleAssignmentTool('delete_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
      }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"success": true');
    });

    it('should remove assignment from day items', async () => {
      await handleAssignmentTool('delete_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
      }, backend);

      // Verify putTrip was called with updated days
      const putCall = backend.calls.find(c => c.method === 'putTrip');
      const updatedTrip = putCall?.args[0] as Itinerary;
      expect(updatedTrip.days[0].items).toHaveLength(0);
    });

    it('should return error for non-existent trip', async () => {
      const result = await handleAssignmentTool('delete_assignment', {
        tripId: 'nonexist',
        assignmentId: sampleAssignment.id,
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Trip not found');
    });

    it('should return error for non-existent assignment', async () => {
      const result = await handleAssignmentTool('delete_assignment', {
        tripId: 'abc12345',
        assignmentId: '660e8400-e29b-41d4-a716-446655440999',
      }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Assignment not found');
    });

    it('should call backend.putTrip to save changes', async () => {
      await handleAssignmentTool('delete_assignment', {
        tripId: 'abc12345',
        assignmentId: sampleAssignment.id,
      }, backend);

      expect(backend.calls).toContainEqual({
        method: 'putTrip',
        args: [expect.objectContaining({ id: 'abc12345' })],
      });
    });
  });

  describe('unknown tool', () => {
    it('should return undefined for unknown tool name', async () => {
      const result = await handleAssignmentTool('unknown_tool', {}, backend);
      expect(result).toBeUndefined();
    });
  });
});
