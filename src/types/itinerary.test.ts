import { describe, it, expect } from 'bun:test';
import { PoiCategorySchema, PlaceOfInterestSchema, ItinerarySchema } from './itinerary';

describe('PoiCategorySchema', () => {
  it('accepts all valid categories', () => {
    const valid = ['restaurant', 'attraction', 'shop', 'outdoor', 'entertainment', 'other'];
    valid.forEach(cat => {
      expect(PoiCategorySchema.safeParse(cat).success).toBe(true);
    });
  });

  it('rejects unknown category', () => {
    expect(PoiCategorySchema.safeParse('museum').success).toBe(false);
  });
});

describe('PlaceOfInterestSchema', () => {
  it('accepts a minimal valid POI', () => {
    const result = PlaceOfInterestSchema.safeParse({
      id: 'abc123',
      name: 'Café de Flore',
      category: 'restaurant',
      city: 'Paris',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated POI', () => {
    const result = PlaceOfInterestSchema.safeParse({
      id: 'abc123',
      name: 'Café de Flore',
      category: 'restaurant',
      city: 'Paris',
      address: '172 Bd Saint-Germain, 75006 Paris',
      lat: 48.854,
      lng: 2.333,
      website: 'https://cafedeflore.fr',
      googleMapsUrl: 'https://maps.google.com/?q=Caf%C3%A9+de+Flore',
      description: 'Historic café on the Left Bank.',
      advisorNotes: 'Go for breakfast — less crowded.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid website URL', () => {
    const result = PlaceOfInterestSchema.safeParse({
      id: 'abc123',
      name: 'Test',
      category: 'shop',
      city: 'Lyon',
      website: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('requires name, category, and city', () => {
    const result = PlaceOfInterestSchema.safeParse({ id: 'abc123' });
    expect(result.success).toBe(false);
  });
});

describe('ItinerarySchema pois field', () => {
  const minimalTrip = {
    id: 'a8k3m2q9',
    title: 'Test Trip',
    startDate: '2026-03-22',
    endDate: '2026-03-28',
    timezone: 'Europe/Paris',
    destinations: ['Paris'],
    days: [],
    pinSalt: 'deadbeefcafebabedeadbeefcafebabe',
    pinHash: '643bf561dd676254c08d60701376ce3e9e638b80210a3f1c3ae0cee0c0ca0ccd',
    updatedAt: '2026-03-27T12:00:00Z',
  };

  it('defaults pois to empty array when omitted', () => {
    const result = ItinerarySchema.safeParse(minimalTrip);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pois).toEqual([]);
  });

  it('accepts a trip with pois', () => {
    const result = ItinerarySchema.safeParse({
      ...minimalTrip,
      pois: [{ id: 'p1', name: 'Eiffel Tower', category: 'attraction', city: 'Paris' }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pois).toHaveLength(1);
  });
});
