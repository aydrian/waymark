#!/usr/bin/env bun
/**
 * Sync production TRIPS KV data to local development environment.
 *
 * Usage:
 *   bun scripts/sync-kv.ts              # Sync all trips
 *   bun scripts/sync-kv.ts --trip=<id>  # Sync single trip by ID
 */

import { $ } from 'bun';

const PRODUCTION_NAMESPACE_ID = '3ff4e7bde86b4346b0cbe41209b2541a';
const LOCAL_BINDING = 'TRIPS';

interface TripKey {
  name: string;
}

function extractJson(text: string): unknown {
  const lines = text.split('\n');
  const jsonStart = lines.findIndex((l) => l.trim().startsWith('[') || l.trim().startsWith('{'));
  if (jsonStart === -1) throw new Error('No JSON found in output');
  return JSON.parse(lines.slice(jsonStart).join('\n'));
}

async function listProductionTrips(): Promise<string[]> {
  const output = await $`wrangler kv key list --namespace-id=${PRODUCTION_NAMESPACE_ID} --remote`.text();
  const result = extractJson(output) as TripKey[];
  return result
    .filter((k) => k.name.startsWith('trip:'))
    .map((k) => k.name);
}

async function getProductionTrip(key: string): Promise<unknown> {
  const output = await $`wrangler kv key get --namespace-id=${PRODUCTION_NAMESPACE_ID} --remote ${key}`.text();
  return extractJson(output);
}

async function putLocalTrip(key: string, value: unknown): Promise<void> {
  const tempFile = `/tmp/${key.replace(':', '_')}.json`;
  await Bun.write(tempFile, JSON.stringify(value));
  await $`wrangler kv key put ${key} --binding=${LOCAL_BINDING} --local --preview --path ${tempFile}`;
  await Bun.file(tempFile).delete();
}

async function syncTrip(key: string): Promise<boolean> {
  try {
    const value = await getProductionTrip(key);
    await putLocalTrip(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to sync ${key}:`, err);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const tripArg = args.find((a) => a.startsWith('--trip='));

  let keys: string[];

  if (tripArg) {
    const tripId = tripArg.split('=')[1];
    keys = [`trip:${tripId}`];
    console.error(`Syncing single trip: ${tripId}`);
  } else {
    console.error('Fetching production trip list...');
    keys = await listProductionTrips();
    console.error(`Found ${keys.length} trip(s) to sync`);
  }

  let successCount = 0;
  let failCount = 0;

  for (const key of keys) {
    const success = await syncTrip(key);
    if (success) {
      successCount++;
      console.error(`Synced: ${key}`);
    } else {
      failCount++;
    }
  }

  console.error(`\nSync complete: ${successCount} succeeded, ${failCount} failed`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
