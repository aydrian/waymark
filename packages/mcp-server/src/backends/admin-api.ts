import type { Itinerary, TripSummary, GlobalPOI } from '@waymark/shared/types';
import type { WaymarkBackend } from './types.js';

interface AdminApiConfig {
  WAYMARK_BASE_URL: string;
  WAYMARK_ADMIN_TOKEN: string;
}

/**
 * Create a backend that uses the Waymark admin API
 */
export function createAdminApiBackend(config: AdminApiConfig): WaymarkBackend {
  const baseUrl = config.WAYMARK_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  const authHeader = `Bearer ${config.WAYMARK_ADMIN_TOKEN}`;

  async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${baseUrl}/api/admin${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as T;
  }

  return {
    // Trip operations
    async listTrips(): Promise<TripSummary[]> {
      const result = await fetchApi<{ trips: TripSummary[] }>('/trips');
      return result.trips || [];
    },

    async getTrip(id: string): Promise<Itinerary | null> {
      try {
        return await fetchApi<Itinerary>(`/trips/${id}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
        throw error;
      }
    },

    async putTrip(trip: Itinerary): Promise<void> {
      await fetchApi('/trips/upsert', {
        method: 'POST',
        body: JSON.stringify(trip),
      });
    },

    async deleteTrip(id: string): Promise<boolean> {
      try {
        await fetchApi('/trips/delete', {
          method: 'POST',
          body: JSON.stringify({ id }),
        });
        return true;
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return false;
        }
        throw error;
      }
    },

    // POI operations
    async listGlobalPOIs(): Promise<GlobalPOI[]> {
      return await fetchApi<GlobalPOI[]>('/pois');
    },

    async getGlobalPOI(id: string): Promise<GlobalPOI | null> {
      try {
        return await fetchApi<GlobalPOI>(`/pois/${id}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
        throw error;
      }
    },

    async putGlobalPOI(poi: GlobalPOI): Promise<void> {
      const { id, ...poiData } = poi;

      if (id) {
        // Update existing POI
        await fetchApi(`/pois/${id}`, {
          method: 'PUT',
          body: JSON.stringify(poiData),
        });
      } else {
        // Create new POI
        await fetchApi('/pois', {
          method: 'POST',
          body: JSON.stringify(poiData),
        });
      }
    },

    async deleteGlobalPOI(id: string): Promise<boolean> {
      try {
        await fetchApi(`/pois/${id}`, {
          method: 'DELETE',
        });
        return true;
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return false;
        }
        throw error;
      }
    },
  };
}
