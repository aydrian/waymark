#!/usr/bin/env bun
/**
 * Migration script: Extract embedded POIs from trips to Global POIs
 *
 * This script uses Wrangler CLI to access KV storage.
 *
 * Usage:
 *   bun run scripts/migrate-pois-cli.ts [--dry-run] [--preview]
 *
 * Requires:
 *   - Wrangler CLI configured with access to your KV namespace
 *   - KV namespace ID configured in wrangler.jsonc
 */

import { execSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const PREVIEW_ONLY = process.argv.includes('--preview');

interface PlaceOfInterest {
  name: string;
  category: string;
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
  website?: string;
  googleMapsUrl?: string;
  description?: string;
  advisorNotes?: string;
}

interface Trip {
  id: string;
  pois?: PlaceOfInterest[];
  poiReferences?: Array<{
    poiId: string;
    tripAdvisorNotes?: string;
    addedAt: string;
  }>;
  [key: string]: unknown;
}

interface GlobalPOI {
  id: string;
  name: string;
  category: string;
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
  website?: string;
  googleMapsUrl?: string;
  description?: string;
  advisorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const KV_BINDING = 'TRIPS';

function kvGet(key: string, usePreview: boolean): unknown | null {
  const previewFlag = usePreview ? '--preview' : '--preview false';
  try {
    const result = execSync(`wrangler kv key get ${key} --binding ${KV_BINDING} --local ${previewFlag}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

function kvPut(key: string, value: unknown, usePreview: boolean): void {
  if (DRY_RUN) return;
  const previewFlag = usePreview ? '--preview' : '--preview false';
  const jsonValue = JSON.stringify(value);
  execSync(`wrangler kv key put ${key} '${jsonValue.replace(/'/g, "'\\''")}' --binding ${KV_BINDING} --local ${previewFlag}`, {
    encoding: 'utf-8',
  });
}

function kvList(prefix: string, usePreview: boolean): string[] {
  const previewFlag = usePreview ? '--preview' : '--preview false';
  try {
    const result = execSync(`wrangler kv key list --prefix ${prefix} --binding ${KV_BINDING} --local ${previewFlag}`, {
      encoding: 'utf-8',
    });
    const keys = JSON.parse(result);
    return keys.map((k: { name: string }) => k.name);
  } catch {
    return [];
  }
}

async function migratePOIsForNamespace(namespace: 'preview' | 'production'): Promise<void> {
  const usePreview = namespace === 'preview';
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Migrating ${namespace.toUpperCase()} namespace`);
  console.log(`${'='.repeat(50)}\n`);

  // Step 1: Collect all unique POIs from trips
  console.log('Step 1: Collecting POIs from trips...');
  const tripKeys = kvList('trip:', usePreview);
  const trips: Trip[] = [];
  const uniquePOIs = new Map<string, { poi: PlaceOfInterest; globalId: string }>();

  for (const key of tripKeys) {
    const tripId = key.slice('trip:'.length);
    const trip = kvGet(`trip:${tripId}`, usePreview) as Trip | null;
    if (!trip) continue;

    trips.push(trip);
    const embeddedPOIs = trip.pois ?? [];

    if (embeddedPOIs.length === 0) {
      console.log(`  ${tripId}: No embedded POIs`);
      continue;
    }

    console.log(`  ${tripId}: Found ${embeddedPOIs.length} embedded POIs`);

    for (const poi of embeddedPOIs) {
      const key_str = `${poi.name.toLowerCase().trim()}|${poi.city.toLowerCase().trim()}|${poi.category}`;
      if (!uniquePOIs.has(key_str)) {
        uniquePOIs.set(key_str, {
          poi,
          globalId: crypto.randomUUID(),
        });
      }
    }
  }

  console.log(`\nFound ${uniquePOIs.size} unique POIs across ${trips.length} trips\n`);

  if (uniquePOIs.size === 0) {
    console.log('No POIs to migrate.\n');
    return;
  }

  // Step 2: Create Global POIs
  console.log('Step 2: Creating Global POIs...');
  const globalPOIMap = new Map<string, GlobalPOI>();
  let globalPOIsCreated = 0;

  // First, check for existing global POIs
  const existingPOIKeys = kvList('poi:', usePreview);
  const existingPOIs = new Map<string, GlobalPOI>();
  for (const key of existingPOIKeys) {
    const poiId = key.slice('poi:'.length);
    const poi = kvGet(`poi:${poiId}`, usePreview) as GlobalPOI | null;
    if (poi) {
      const key_str = `${poi.name.toLowerCase().trim()}|${poi.city.toLowerCase().trim()}|${poi.category}`;
      existingPOIs.set(key_str, poi);
    }
  }

  for (const [key_str, { poi, globalId }] of uniquePOIs) {
    // Check if a similar POI already exists
    const existing = existingPOIs.get(key_str);
    if (existing) {
      console.log(`  Reusing existing Global POI: ${existing.name} (${existing.id})`);
      globalPOIMap.set(key_str, existing);
      continue;
    }

    const now = new Date().toISOString();
    const globalPOI: GlobalPOI = {
      id: globalId,
      name: poi.name,
      category: poi.category,
      city: poi.city,
      address: poi.address,
      lat: poi.lat,
      lng: poi.lng,
      website: poi.website,
      googleMapsUrl: poi.googleMapsUrl,
      description: poi.description,
      advisorNotes: poi.advisorNotes,
      createdAt: now,
      updatedAt: now,
    };

    globalPOIMap.set(key_str, globalPOI);

    if (!DRY_RUN) {
      kvPut(`poi:${globalId}`, globalPOI, usePreview);
      console.log(`  Created Global POI: ${globalPOI.name} (${globalId})`);
    } else {
      console.log(`  [DRY RUN] Would create Global POI: ${globalPOI.name} (${globalId})`);
    }

    globalPOIsCreated++;
  }

  // Step 3: Update trips to use poiReferences
  console.log(`\nStep 3: Updating trips to use poiReferences...`);
  let tripsUpdated = 0;

  for (const trip of trips) {
    const embeddedPOIs = trip.pois ?? [];
    if (embeddedPOIs.length === 0 && (!trip.poiReferences || trip.poiReferences.length === 0)) {
      continue;
    }

    // Build poiReferences from embedded POIs
    const newReferences: Trip['poiReferences'] = [];

    for (const poi of embeddedPOIs) {
      const key_str = `${poi.name.toLowerCase().trim()}|${poi.city.toLowerCase().trim()}|${poi.category}`;
      const globalPOI = globalPOIMap.get(key_str);

      if (globalPOI) {
        newReferences.push({
          poiId: globalPOI.id,
          tripAdvisorNotes: poi.advisorNotes,
          addedAt: new Date().toISOString(),
        });
      }
    }

    // Combine with existing poiReferences if any
    const existingReferences = trip.poiReferences ?? [];
    const combinedReferences = [...existingReferences, ...newReferences];

    // Deduplicate by poiId
    const dedupedReferences = Array.from(
      new Map(combinedReferences.map(r => [r.poiId, r])).values()
    );

    if (!DRY_RUN) {
      const updatedTrip = {
        ...trip,
        poiReferences: dedupedReferences,
        updatedAt: new Date().toISOString(),
      };

      kvPut(`trip:${trip.id}`, updatedTrip, usePreview);
      console.log(`  Updated ${trip.id}: ${dedupedReferences.length} POI references`);
      tripsUpdated++;
    } else {
      console.log(`  [DRY RUN] Would update ${trip.id}: ${dedupedReferences.length} POI references`);
    }
  }

  console.log(`\n${namespace.toUpperCase()} Migration Complete!`);
  console.log(`Trips processed: ${trips.length}`);
  console.log(`Trips updated: ${tripsUpdated}`);
  console.log(`Unique POIs found: ${uniquePOIs.size}`);
  console.log(`Global POIs created: ${globalPOIsCreated}`);
}

async function main(): Promise<void> {
  console.log(`Starting POI migration${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  if (PREVIEW_ONLY) {
    await migratePOIsForNamespace('preview');
  } else {
    // Migrate both namespaces
    await migratePOIsForNamespace('preview');
    await migratePOIsForNamespace('production');
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('All Migrations Complete!');
  console.log(`${'='.repeat(50)}`);

  if (DRY_RUN) {
    console.log(`\nThis was a dry run. No changes were made.`);
    console.log(`Run without --dry-run to apply changes.`);
  }
}

main().catch(console.error);
