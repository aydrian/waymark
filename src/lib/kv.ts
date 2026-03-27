import { ItinerarySchema, type Itinerary, type TripSummary } from '../types/itinerary';

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
