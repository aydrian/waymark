import { describe, test, expect, mock, afterEach } from 'bun:test';
import {
  parseGoogleMapsUrlString,
  isShortenedMapsUrl,
  resolveShortenedMapsUrl,
  parseGoogleMapsUrl,
} from './maps-url';

describe('parseGoogleMapsUrlString', () => {
  test('parses lat/lng from full place URL with @lat,lng,zoom', () => {
    const url =
      'https://www.google.com/maps/place/Colosseum/@41.8902,12.4922,17z/data=!3m1!4b1';
    const result = parseGoogleMapsUrlString(url);
    expect(result).toEqual({ lat: 41.8902, lng: 12.4922, nameSlug: 'Colosseum' });
  });

  test('parses lat/lng from legacy ?q=lat,lng URL', () => {
    const url = 'https://maps.google.com/?q=48.8566,2.3522';
    const result = parseGoogleMapsUrlString(url);
    expect(result).toEqual({ lat: 48.8566, lng: 2.3522 });
  });

  test('decodes percent-encoded name slug and replaces + with space', () => {
    const url =
      'https://www.google.com/maps/place/Caf%C3%A9+de+Flore/@48.8540,2.3330,17z/data=!3m1!4b1';
    const result = parseGoogleMapsUrlString(url);
    expect(result?.nameSlug).toBe('Café de Flore');
  });

  test('returns null for out-of-range latitude', () => {
    const url = 'https://www.google.com/maps/place/Nowhere/@91.0000,12.4922,17z';
    expect(parseGoogleMapsUrlString(url)).toBeNull();
  });

  test('returns null for out-of-range longitude', () => {
    const url = 'https://www.google.com/maps/place/Nowhere/@41.8902,181.0000,17z';
    expect(parseGoogleMapsUrlString(url)).toBeNull();
  });

  test('returns null for garbage string', () => {
    expect(parseGoogleMapsUrlString('not a url at all')).toBeNull();
  });
});

describe('isShortenedMapsUrl', () => {
  test('returns true for maps.app.goo.gl URL', () => {
    expect(isShortenedMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
  });

  test('returns true for goo.gl URL', () => {
    expect(isShortenedMapsUrl('https://goo.gl/maps/abc123')).toBe(true);
  });

  test('returns false for full google.com/maps URL', () => {
    expect(
      isShortenedMapsUrl('https://www.google.com/maps/place/Colosseum/@41.8902,12.4922,17z')
    ).toBe(false);
  });
});

describe('resolveShortenedMapsUrl', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns resolved URL when fetch succeeds', async () => {
    const resolvedUrl = 'https://www.google.com/maps/place/Colosseum/@41.8902,12.4922,17z';
    globalThis.fetch = mock(async () => ({ ok: true, url: resolvedUrl }) as Response);

    const result = await resolveShortenedMapsUrl('https://maps.app.goo.gl/abc123');
    expect(result).toBe(resolvedUrl);
  });

  test('returns null when fetch rejects', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network error');
    });

    const result = await resolveShortenedMapsUrl('https://maps.app.goo.gl/abc123');
    expect(result).toBeNull();
  });
});

describe('parseGoogleMapsUrl', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('parses full URL directly without fetching', async () => {
    const url =
      'https://www.google.com/maps/place/Colosseum/@41.8902,12.4922,17z/data=!3m1!4b1';
    const result = await parseGoogleMapsUrl(url);
    expect(result).toEqual({ lat: 41.8902, lng: 12.4922, nameSlug: 'Colosseum' });
  });

  test('resolves shortened URL then parses', async () => {
    const resolvedUrl =
      'https://www.google.com/maps/place/Colosseum/@41.8902,12.4922,17z/data=!3m1!4b1';
    globalThis.fetch = mock(async () => ({ ok: true, url: resolvedUrl }) as Response);

    const result = await parseGoogleMapsUrl('https://maps.app.goo.gl/abc123');
    expect(result).toEqual({ lat: 41.8902, lng: 12.4922, nameSlug: 'Colosseum' });
  });

  test('returns null when shortened URL cannot be resolved', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network error');
    });

    const result = await parseGoogleMapsUrl('https://maps.app.goo.gl/abc123');
    expect(result).toBeNull();
  });
});
