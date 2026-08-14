export interface ParsedMapsUrl {
  lat: number;
  lng: number;
  nameSlug?: string;
}

export function parseGoogleMapsUrlString(url: string): ParsedMapsUrl | null {
  // Extract name slug from /place/<slug>/
  let nameSlug: string | undefined;
  const placeMatch = url.match(/\/place\/([^/]+)\//);
  if (placeMatch) {
    nameSlug = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
  }

  // Try @lat,lng,zoom pattern first (standard place URLs)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, ...(nameSlug ? { nameSlug } : {}) };
  }

  // Try legacy ?q=lat,lng pattern
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng, ...(nameSlug ? { nameSlug } : {}) };
  }

  return null;
}

export function isShortenedMapsUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'goo.gl' || hostname === 'maps.app.goo.gl' || hostname === 'app.goo.gl';
  } catch {
    return false;
  }
}

export async function resolveShortenedMapsUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    return response.ok ? response.url : null;
  } catch {
    return null;
  }
}

export async function parseGoogleMapsUrl(url: string): Promise<ParsedMapsUrl | null> {
  if (isShortenedMapsUrl(url)) {
    const resolved = await resolveShortenedMapsUrl(url);
    if (!resolved) return null;
    return parseGoogleMapsUrlString(resolved);
  }
  return parseGoogleMapsUrlString(url);
}
