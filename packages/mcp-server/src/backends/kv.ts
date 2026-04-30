import {
  getTrip,
  putTrip,
  deleteTrip,
  listTrips,
  getGlobalPOI,
  putGlobalPOI,
  deleteGlobalPOI,
  listGlobalPOIs,
} from '@itsaydrian/waymark-shared/lib';
import type { Itinerary, TripSummary, GlobalPOI } from '@itsaydrian/waymark-shared/types';
import type { WaymarkBackend } from './types.js';

interface KVConfig {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_KV_NAMESPACE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}

/**
 * Create a KV namespace binding that uses Cloudflare API
 */
function createKVNamespace(config: KVConfig): KVNamespace {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${config.CLOUDFLARE_KV_NAMESPACE_ID}`;
  const authHeader = `Bearer ${config.CLOUDFLARE_API_TOKEN}`;

  return {
    async get(key: string, type?: string): Promise<string | null> {
      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        headers: { Authorization: authHeader },
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`KV get failed: ${response.statusText}`);

      if (type === 'json') {
        return response.json() as Promise<string>;
      }
      return response.text();
    },

    async put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void> {
      // Convert value to Blob for FormData
      let blob: Blob;
      if (typeof value === 'string') {
        blob = new Blob([value], { type: 'text/plain' });
      } else if (value instanceof ArrayBuffer) {
        blob = new Blob([value]);
      } else {
        // ReadableStream - convert to blob
        const reader = value.getReader();
        const chunks: ArrayBuffer[] = [];
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
        }
        blob = new Blob(chunks);
      }

      const formData = new FormData();
      formData.append('value', blob);

      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: formData,
      });

      if (!response.ok) throw new Error(`KV put failed: ${response.statusText}`);
    },

    async delete(key: string): Promise<void> {
      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });

      if (!response.ok) throw new Error(`KV delete failed: ${response.statusText}`);
    },

    async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number }[]; list_complete: boolean; cursor?: string }> {
      const params = new URLSearchParams();
      if (options?.prefix) params.append('prefix', options.prefix);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);

      const response = await fetch(`${baseUrl}/keys?${params}`, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) throw new Error(`KV list failed: ${response.statusText}`);

      const data = await response.json() as { result: { name: string; expiration?: number }[]; result_info?: { cursor?: string } };
      return {
        keys: data.result,
        list_complete: !data.result_info?.cursor,
        cursor: data.result_info?.cursor,
      };
    },
  } as KVNamespace;
}

/**
 * Create a backend that uses direct Cloudflare KV access
 */
export function createKVBackend(config: KVConfig): WaymarkBackend {
  const kv = createKVNamespace(config);

  return {
    // Trip operations
    listTrips(): Promise<TripSummary[]> {
      return listTrips(kv);
    },

    getTrip(id: string): Promise<Itinerary | null> {
      return getTrip(kv, id);
    },

    putTrip(trip: Itinerary): Promise<void> {
      return putTrip(kv, trip);
    },

    deleteTrip(id: string): Promise<boolean> {
      return deleteTrip(kv, id);
    },

    // POI operations
    listGlobalPOIs(): Promise<GlobalPOI[]> {
      return listGlobalPOIs(kv);
    },

    getGlobalPOI(id: string): Promise<GlobalPOI | null> {
      return getGlobalPOI(kv, id);
    },

    putGlobalPOI(poi: GlobalPOI): Promise<void> {
      return putGlobalPOI(kv, poi);
    },

    deleteGlobalPOI(id: string): Promise<boolean> {
      return deleteGlobalPOI(kv, id);
    },
  };
}
