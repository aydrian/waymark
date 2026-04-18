#!/usr/bin/env bun
/**
 * Migration script: Extract embedded POIs from trips to Global POIs
 *
 * This script:
 * 1. Iterates through all trips
 * 2. Extracts unique POIs (by name + city + category)
 * 3. Creates Global POIs in KV
 * 4. Updates trips to use poiReferences instead of embedded pois
 *
 * Usage:
 *   bun run scripts/migrate-pois.ts [--dry-run]
 *
 * Environment:
 *   Requires TRIPS KV binding. Run via Wrangler:
 *   wrangler dev --local -- bun run scripts/migrate-pois.ts
 */

import { env } from 'cloudflare:workers';
import { getTrip, putTrip, listTrips, putGlobalPOI, getGlobalPOI } from '../src/lib/kv';
import type { PlaceOfInterest, TripPOIReference, GlobalPOI } from '../src/types/itinerary';

interface MigrationStats {
  tripsProcessed: number;
  tripsUpdated: number;
  uniquePOIsFound: number;
  globalPOIsCreated: number;
  errors: string[];
}

interface UniquePOI {
  key: string;
  poi: PlaceOfInterest;
  globalId: string;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function migratePOIs(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tripsProcessed: 0,
    tripsUpdated: 0,
    uniquePOIsFound: 0,
    globalPOIsCreated: 0,
    errors: [],
  };

  console.log(`Starting POI migration${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  // Step 1: Collect all unique POIs from trips
  console.log('Step 1: Collecting POIs from trips...');
  const trips = await listTrips(env.TRIPS);
  const uniquePOIs = new Map<string, UniquePOI>();

  for (const tripSummary of trips) {
    const trip = await getTrip(env.TRIPS, tripSummary.id);
    if (!trip) {
      stats.errors.push(`Failed to load trip ${tripSummary.id}`);
      continue;
    }

    stats.tripsProcessed++;

    const embeddedPOIs = trip.pois ?? [];
    if (embeddedPOIs.length === 0) {
      console.log(`  ${trip.id}: No embedded POIs`);
      continue;
    }

    console.log(`  ${trip.id}: Found ${embeddedPOIs.length} embedded POIs`);

    for (const poi of embeddedPOIs) {
      // Create unique key based on name + city + category
      const key = `${poi.name.toLowerCase().trim()}|${poi.city.toLowerCase().trim()}|${poi.category}`;

      if (!uniquePOIs.has(key)) {
        const globalId = crypto.randomUUID();
        uniquePOIs.set(key, {
          key,
          poi,
          globalId,
        });
      }
    }
  }

  stats.uniquePOIsFound = uniquePOIs.size;
  console.log(`\nFound ${stats.uniquePOIsFound} unique POIs across ${stats.tripsProcessed} trips\n`);

  if (stats.uniquePOIsFound === 0) {
    console.log('No POIs to migrate. Exiting.');
    return stats;
  }

  // Step 2: Create Global POIs
  console.log('Step 2: Creating Global POIs...');
  const globalPOIMap = new Map<string, GlobalPOI>();

  for (const [key, uniquePOI] of uniquePOIs) {
    // Check if a similar POI already exists in global
    const existingGlobal = await findExistingGlobalPOI(uniquePOI.poi);

    if (existingGlobal) {
      console.log(`  Reusing existing Global POI: ${existingGlobal.name} (${existingGlobal.id})`);
      globalPOIMap.set(key, existingGlobal);
    } else {
      const now = new Date().toISOString();
      const globalPOI: GlobalPOI = {
        id: uniquePOI.globalId,
        name: uniquePOI.poi.name,
        category: uniquePOI.poi.category,
        city: uniquePOI.poi.city,
        address: uniquePOI.poi.address,
        lat: uniquePOI.poi.lat,
        lng: uniquePOI.poi.lng,
        website: uniquePOI.poi.website,
        googleMapsUrl: uniquePOI.poi.googleMapsUrl,
        description: uniquePOI.poi.description,
        advisorNotes: uniquePOI.poi.advisorNotes,
        createdAt: now,
        updatedAt: now,
      };

      globalPOIMap.set(key, globalPOI);

      if (!DRY_RUN) {
        await putGlobalPOI(env.TRIPS, globalPOI);
        console.log(`  Created Global POI: ${globalPOI.name} (${globalPOI.id})`);
      } else {
        console.log(`  [DRY RUN] Would create Global POI: ${globalPOI.name} (${globalPOI.id})`);
      }

      stats.globalPOIsCreated++;
    }
  }

  // Step 3: Update trips to use poiReferences
  console.log(`\nStep 3: Updating trips to use poiReferences...`);

  for (const tripSummary of trips) {
    const trip = await getTrip(env.TRIPS, tripSummary.id);
    if (!trip) continue;

    const embeddedPOIs = trip.pois ?? [];
    if (embeddedPOIs.length === 0 && (!trip.poiReferences || trip.poiReferences.length === 0)) {
      continue;
    }

    // Build poiReferences from embedded POIs
    const newReferences: TripPOIReference[] = [];

    for (const poi of embeddedPOIs) {
      const key = `${poi.name.toLowerCase().trim()}|${poi.city.toLowerCase().trim()}|${poi.category}`;
      const globalPOI = globalPOIMap.get(key);

      if (globalPOI) {
        newReferences.push({
          poiId: globalPOI.id,
          tripAdvisorNotes: poi.advisorNotes, // Move embedded advisorNotes to tripAdvisorNotes
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
        // Keep embedded pois for now (backward compatibility), but they can be removed later
        updatedAt: new Date().toISOString(),
      };

      await putTrip(env.TRIPS, updatedTrip);
      console.log(`  Updated ${trip.id}: ${dedupedReferences.length} POI references`);
      stats.tripsUpdated++;
    } else {
      console.log(`  [DRY RUN] Would update ${trip.id}: ${dedupedReferences.length} POI references`);
    }
  }

  return stats;
}

async function findExistingGlobalPOI(poi: PlaceOfInterest): Promise<GlobalPOI | null> {
  // List all global POIs and check for similar ones
  // This is inefficient but works for small datasets
  // In production, you might want to use a more sophisticated approach

  const { keys } = await env.TRIPS.list({ prefix: 'poi:' });

  for (const { name } of keys.slice(0, 100)) { // Limit to avoid too many requests
    const id = name.slice('poi:'.length);
    const globalPOI = await getGlobalPOI(env.TRIPS, id);
    if (globalPOI) {
      // Check if this is a match (same name and city, ignoring case)
      if (
        globalPOI.name.toLowerCase().trim() === poi.name.toLowerCase().trim() &&
        globalPOI.city.toLowerCase().trim() === poi.city.toLowerCase().trim()
      ) {
        return globalPOI;
      }
    }
  }

  return null;
}

async function main() {
  try {
    const stats = await migratePOIs();

    console.log(`\n${'='.repeat(50)}`);
    console.log('Migration Complete!');
    console.log(`${'='.repeat(50)}`);
    console.log(`Trips processed: ${stats.tripsProcessed}`);
    console.log(`Trips updated: ${stats.tripsUpdated}`);
    console.log(`Unique POIs found: ${stats.uniquePOIsFound}`);
    console.log(`Global POIs created: ${stats.globalPOIsCreated}`);

    if (stats.errors.length > 0) {
      console.log(`\nErrors (${stats.errors.length}):`);
      stats.errors.forEach(e => console.log(`  - ${e}`));
    }

    if (DRY_RUN) {
      console.log(`\nThis was a dry run. No changes were made.`);
      console.log(`Run without --dry-run to apply changes.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
