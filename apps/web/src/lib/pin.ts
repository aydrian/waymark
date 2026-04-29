// Uses PBKDF2-SHA256 (100k iterations) — runs in Cloudflare Workers via Web Crypto

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
