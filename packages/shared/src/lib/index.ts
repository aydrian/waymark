import { ItinerarySchema, GlobalPOISchema, type Itinerary, type TripSummary, type GlobalPOI } from '../types/index.js';

const key = (id: string) => `trip:${id}`;

export async function getTrip(kv: KVNamespace, id: string): Promise<Itinerary | null> {
  const raw = await kv.get(key(id), 'text');
  if (!raw) return null;
  const parsed = ItinerarySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error(`[kv] Schema parse failed for trip:${id}`, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

export async function putTrip(kv: KVNamespace, trip: Itinerary): Promise<void> {
  await kv.put(key(trip.id), JSON.stringify(trip));
}

export async function tripExists(kv: KVNamespace, id: string): Promise<boolean> {
  const val = await kv.get(key(id), 'text');
  return val !== null;
}

export async function deleteTrip(kv: KVNamespace, id: string): Promise<boolean> {
  const exists = await tripExists(kv, id);
  if (!exists) return false;
  await kv.delete(key(id));
  return true;
}

export async function listTrips(kv: KVNamespace): Promise<TripSummary[]> {
  const { keys } = await kv.list({ prefix: 'trip:' });
  const trips = await Promise.all(
    keys.map(({ name }) => getTrip(kv, name.slice('trip:'.length)))
  );
  return trips
    .filter((t): t is Itinerary => t !== null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      startDate: t.startDate,
      endDate: t.endDate,
      destinations: t.destinations,
      travelers: t.travelers ?? [],
      updatedAt: t.updatedAt,
    }));
}

// Global POI functions
const poiKey = (id: string) => `poi:${id}`;

export async function getGlobalPOI(kv: KVNamespace, id: string): Promise<GlobalPOI | null> {
  const raw = await kv.get(poiKey(id), 'text');
  if (!raw) return null;
  const parsed = GlobalPOISchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error(`[kv] Schema parse failed for poi:${id}`, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

export async function putGlobalPOI(kv: KVNamespace, poi: GlobalPOI): Promise<void> {
  await kv.put(poiKey(poi.id), JSON.stringify(poi));
}

export async function globalPOIExists(kv: KVNamespace, id: string): Promise<boolean> {
  const val = await kv.get(poiKey(id), 'text');
  return val !== null;
}

export async function deleteGlobalPOI(kv: KVNamespace, id: string): Promise<boolean> {
  const exists = await globalPOIExists(kv, id);
  if (!exists) return false;
  await kv.delete(poiKey(id));
  return true;
}

export async function listGlobalPOIs(kv: KVNamespace): Promise<GlobalPOI[]> {
  const { keys } = await kv.list({ prefix: 'poi:' });
  const pois = await Promise.all(
    keys.map(({ name }) => getGlobalPOI(kv, name.slice('poi:'.length)))
  );
  return pois.filter((p): p is GlobalPOI => p !== null);
}

// PIN hashing utilities (used for trip access and admin auth)

const enc = new TextEncoder();

/** Derive a hex hash of pin+salt using PBKDF2 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time comparison of two hex strings */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify a plain PIN against stored salt+hash */
export async function verifyPin(pin: string, salt: string, storedHash: string): Promise<boolean> {
  const candidate = await hashPin(pin, salt);
  return safeEqual(candidate, storedHash);
}

/** Generate a random hex salt */
export function generateSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
