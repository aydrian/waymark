import { describe, it, expect, beforeEach } from 'vitest';
import { handleTripTool, tripTools } from '../../tools/trips.js';
import { createMockBackend } from '../mocks/mock-backend.js';
import type { Itinerary } from '@itsaydrian/waymark-shared/types';

describe('tripTools', () => {
  it('should export 5 trip tools', () => {
    expect(tripTools).toHaveLength(5);
    expect(tripTools.map(t => t.name)).toContain('list_trips');
    expect(tripTools.map(t => t.name)).toContain('get_trip');
    expect(tripTools.map(t => t.name)).toContain('create_trip');
    expect(tripTools.map(t => t.name)).toContain('update_trip');
    expect(tripTools.map(t => t.name)).toContain('delete_trip');
  });

  it('should have proper input schemas', () => {
    const getTrip = tripTools.find(t => t.name === 'get_trip');
    expect(getTrip?.inputSchema).toEqual({
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '8-character alphanumeric trip ID (e.g., a8k3m2q9)',
        },
      },
      required: ['id'],
    });
  });
});

describe('handleTripTool', () => {
  let backend: ReturnType<typeof createMockBackend>;

  const sampleTrip: Itinerary = {
    id: 'abc12345',
    title: 'Test Trip',
    startDate: '2024-06-01',
    endDate: '2024-06-07',
    timezone: 'Europe/Paris',
    destinations: ['Paris', 'Rome'],
    pinSalt: 'salt123',
    pinHash: 'hash456',
    days: [],
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
  });

  describe('list_trips', () => {
    it('should return empty array when no trips exist', async () => {
      const result = await handleTripTool('list_trips', {}, backend);
      expect(result).toEqual({
        content: [{ type: 'text', text: JSON.stringify({ trips: [], count: 0 }, null, 2) }],
      });
    });

    it('should return all trips with count', async () => {
      backend.seedTrips([sampleTrip]);
      const result = await handleTripTool('list_trips', {}, backend);

      expect(result?.content[0].text).toContain('Test Trip');
      expect(result?.content[0].text).toContain('"count": 1');
    });

    it('should call backend.listTrips', async () => {
      await handleTripTool('list_trips', {}, backend);
      expect(backend.calls).toContainEqual({ method: 'listTrips', args: [] });
    });
  });

  describe('get_trip', () => {
    it('should return trip when found', async () => {
      backend.seedTrips([sampleTrip]);
      const result = await handleTripTool('get_trip', { id: 'abc12345' }, backend);

      expect(result?.content[0].text).toContain('Test Trip');
      expect(result?.content[0].text).toContain('abc12345');
    });

    it('should return error for non-existent trip', async () => {
      const result = await handleTripTool('get_trip', { id: 'nonexist' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Trip not found');
    });

    it('should return validation error for invalid id format', async () => {
      const result = await handleTripTool('get_trip', { id: 'invalid-id' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should return validation error for uppercase id', async () => {
      const result = await handleTripTool('get_trip', { id: 'ABC12345' }, backend);

      expect(result?.isError).toBe(true);
    });

    it('should return validation error for short id', async () => {
      const result = await handleTripTool('get_trip', { id: 'abc123' }, backend);

      expect(result?.isError).toBe(true);
    });
  });

  describe('create_trip', () => {
    const validTripInput = {
      id: 'xyz99999',
      title: 'New Trip',
      startDate: '2024-07-01',
      endDate: '2024-07-10',
      timezone: 'America/New_York',
      destinations: ['New York'],
      days: [{ date: '2024-07-01', dayNumber: 1, title: 'Day 1', items: [] }],
    };

    it('should create trip with valid input', async () => {
      const result = await handleTripTool('create_trip', validTripInput, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"ok": true');
      expect(result?.content[0].text).toContain('"id": "xyz99999"');
    });

    it('should call backend.putTrip with correct data', async () => {
      await handleTripTool('create_trip', validTripInput, backend);

      expect(backend.calls).toContainEqual({
        method: 'putTrip',
        args: [expect.objectContaining({ id: 'xyz99999', title: 'New Trip' })],
      });
    });

    it('should hash PIN when plain pin is provided', async () => {
      const result = await handleTripTool('create_trip', { ...validTripInput, pin: '1234' }, backend);

      expect(result?.isError).toBeUndefined();
      const putCall = backend.calls.find(c => c.method === 'putTrip');
      expect(putCall?.args[0]).toHaveProperty('pinSalt');
      expect(putCall?.args[0]).toHaveProperty('pinHash');
      expect(putCall?.args[0]).not.toHaveProperty('pin');
    });

    it('should accept pre-hashed PIN', async () => {
      const result = await handleTripTool('create_trip', {
        ...validTripInput,
        pinSalt: 'presalt',
        pinHash: 'prehash',
      }, backend);

      expect(result?.isError).toBeUndefined();
      const putCall = backend.calls.find(c => c.method === 'putTrip');
      expect(putCall?.args[0]).toHaveProperty('pinSalt', 'presalt');
      expect(putCall?.args[0]).toHaveProperty('pinHash', 'prehash');
    });

    it('should return validation error for missing required fields', async () => {
      const result = await handleTripTool('create_trip', { title: 'Incomplete' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should add updatedAt timestamp', async () => {
      await handleTripTool('create_trip', validTripInput, backend);

      const putCall = backend.calls.find(c => c.method === 'putTrip');
      expect(putCall?.args[0]).toHaveProperty('updatedAt');
      const tripArg = putCall?.args[0] as Itinerary;
      expect(tripArg.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('update_trip', () => {
    const validUpdateInput = {
      ...sampleTrip,
      title: 'Updated Title',
    };

    it('should update existing trip', async () => {
      backend.seedTrips([sampleTrip]);
      const result = await handleTripTool('update_trip', validUpdateInput, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"ok": true');
    });

    it('should return error for non-existent trip', async () => {
      const result = await handleTripTool('update_trip', validUpdateInput, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Trip not found');
    });

    it('should accept any string as date (schema allows any string)', async () => {
      backend.seedTrips([sampleTrip]);
      // The ItinerarySchema uses z.string() for dates, not strict date validation
      const inputWithNonStandardDate = { ...validUpdateInput, startDate: 'any-string-works' };
      const result = await handleTripTool('update_trip', inputWithNonStandardDate, backend);

      // Should NOT error because the schema accepts any string
      expect(result?.isError).toBeUndefined();
    });

    it('should call backend.putTrip', async () => {
      backend.seedTrips([sampleTrip]);
      await handleTripTool('update_trip', validUpdateInput, backend);

      expect(backend.calls).toContainEqual({
        method: 'putTrip',
        args: [expect.objectContaining({ id: 'abc12345', title: 'Updated Title' })],
      });
    });
  });

  describe('delete_trip', () => {
    it('should delete existing trip', async () => {
      backend.seedTrips([sampleTrip]);
      const result = await handleTripTool('delete_trip', { id: 'abc12345' }, backend);

      expect(result?.isError).toBeUndefined();
      expect(result?.content[0].text).toContain('"ok": true');
      expect(result?.content[0].text).toContain('"deleted": true');
    });

    it('should return deleted: false for non-existent trip', async () => {
      const result = await handleTripTool('delete_trip', { id: 'nonexist' }, backend);

      expect(result?.content[0].text).toContain('"deleted": false');
    });

    it('should return validation error for invalid id', async () => {
      const result = await handleTripTool('delete_trip', { id: 'INVALID' }, backend);

      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain('Validation error');
    });

    it('should call backend.deleteTrip', async () => {
      await handleTripTool('delete_trip', { id: 'abc12345' }, backend);

      expect(backend.calls).toContainEqual({ method: 'deleteTrip', args: ['abc12345'] });
    });
  });

  describe('unknown tool', () => {
    it('should return undefined for unknown tool name', async () => {
      const result = await handleTripTool('unknown_tool', {}, backend);
      expect(result).toBeUndefined();
    });
  });
});
