/**
 * Usage: bun scripts/hash-pin.ts <pin> <salt>
 * Prints the PBKDF2-SHA256 hash of the pin+salt pair.
 * Use the output as pinHash in your itinerary JSON.
 */

export {};

const [, , pin, salt] = Bun.argv;
if (!pin || !salt) {
  console.error('Usage: bun scripts/hash-pin.ts <pin> <salt>');
  Bun.exit(1);
}

const enc = new TextEncoder();
const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 },
  keyMaterial,
  256,
);
const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
console.log(hash);
