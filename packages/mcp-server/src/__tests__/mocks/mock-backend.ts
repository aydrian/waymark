import type { Itinerary, TripSummary, GlobalPOI } from '@itsaydrian/waymark-shared/types';
import type { WaymarkBackend } from '../../backends/types.js';

/**
 * Create a mock WaymarkBackend for testing tool handlers in isolation.
 * Uses in-memory storage and tracks all calls for assertions.
 */
export function createMockBackend(): WaymarkBackend & {
  trips: Map<string, Itinerary>;
  pois: Map<string, GlobalPOI>;
  calls: Array<{ method: string; args: unknown[] }>;
  clear(): void;
  seedTrips(trips: Itinerary[]): void;
  seedPOIs(pois: GlobalPOI[]): void;
} {
  const trips = new Map<string, Itinerary>();
  const pois = new Map<string, GlobalPOI>();
  const calls: Array<{ method: string; args: unknown[] }> = [];

  function trackCall(method: string, args: unknown[]) {
    calls.push({ method, args });
  }

  return {
    trips,
    pois,
    calls,

    clear() {
      trips.clear();
      pois.clear();
      calls.length = 0;
    },

    seedTrips(seedTrips: Itinerary[]) {
      for (const trip of seedTrips) {
        trips.set(trip.id, trip);
      }
    },

    seedPOIs(seedPOIs: GlobalPOI[]) {
      for (const poi of seedPOIs) {
        pois.set(poi.id, poi);
      }
    },

    // Trip operations
    async listTrips(): Promise<TripSummary[]> {
      trackCall('listTrips', []);
      return Array.from(trips.values()).map(t => ({
        id: t.id,
        title: t.title,
        startDate: t.startDate,
        endDate: t.endDate,
        destinations: t.destinations,
        timezone: t.timezone,
        updatedAt: t.updatedAt,
        travelers: t.travelers || [],
      }));
    },

    async getTrip(id: string): Promise<Itinerary | null> {
      trackCall('getTrip', [id]);
      return trips.get(id) || null;
    },

    async putTrip(trip: Itinerary): Promise<void> {
      trackCall('putTrip', [trip]);
      trips.set(trip.id, trip);
    },

    async deleteTrip(id: string): Promise<boolean> {
      trackCall('deleteTrip', [id]);
      return trips.delete(id);
    },

    // POI operations
    async listGlobalPOIs(): Promise<GlobalPOI[]> {
      trackCall('listGlobalPOIs', []);
      return Array.from(pois.values());
    },

    async getGlobalPOI(id: string): Promise<GlobalPOI | null> {
      trackCall('getGlobalPOI', [id]);
      return pois.get(id) || null;
    },

    async createGlobalPOI(poi: Omit<GlobalPOI, 'id' | 'createdAt' | 'updatedAt'>): Promise<GlobalPOI> {
      trackCall('createGlobalPOI', [poi]);
      const newPoi: GlobalPOI = {
        ...poi,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      pois.set(newPoi.id, newPoi);
      return newPoi;
    },

    async putGlobalPOI(poi: GlobalPOI): Promise<void> {
      trackCall('putGlobalPOI', [poi]);
      pois.set(poi.id, { ...poi, updatedAt: new Date().toISOString() });
    },

    async deleteGlobalPOI(id: string): Promise<boolean> {
      trackCall('deleteGlobalPOI', [id]);
      return pois.delete(id);
    },
  };
}
