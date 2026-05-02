import type { Itinerary, TripSummary, GlobalPOI, PoiAssignment } from '@itsaydrian/waymark-shared/types';

/**
 * Abstract interface for Waymark data operations.
 * Implementations can use direct KV access or admin API calls.
 */
export interface WaymarkBackend {
  // Trip operations
  listTrips(): Promise<TripSummary[]>;
  getTrip(id: string): Promise<Itinerary | null>;
  putTrip(trip: Itinerary): Promise<void>;
  deleteTrip(id: string): Promise<boolean>;

  // POI operations
  listGlobalPOIs(): Promise<GlobalPOI[]>;
  getGlobalPOI(id: string): Promise<GlobalPOI | null>;
  createGlobalPOI(poi: Omit<GlobalPOI, 'id' | 'createdAt' | 'updatedAt'>): Promise<GlobalPOI>;
  putGlobalPOI(poi: GlobalPOI): Promise<void>;
  deleteGlobalPOI(id: string): Promise<boolean>;
}
