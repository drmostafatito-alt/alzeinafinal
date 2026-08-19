
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const unb64 = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};

const secretKey = async (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);

export async function signJwt(payload, secret, ttlSeconds = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + ttlSeconds };
  const input = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(body)))}`;
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await secretKey(secret), enc.encode(input)));
  return `${input}.${b64url(sig)}`;
}

export async function verifyJwt(token, secret) {
  try {
    const [h,p,s] = String(token).split('.');
    if (!h || !p || !s) return null;
    const input = `${h}.${p}`;
    const ok = await crypto.subtle.verify('HMAC', await secretKey(secret), unb64(s), enc.encode(input));
    if (!ok) return null;
    const body = JSON.parse(dec.decode(unb64(p)));
    if (body.exp && Date.now() > body.exp * 1000) return null;
    return body;
  } catch { return null; }
}

/**
 * PBKDF2 parameters — Cloudflare Workers compatibility.
 *
 * Workers' WebCrypto rejects PBKDF2 iteration counts ABOVE 100,000 with
 * `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
 * supported`. The previous value (210,000) therefore made every login throw
 * a 500 in production.
 *
 * - New hashes use PBKDF2_ITERATIONS = 100,000 — the highest count the Workers
 *   runtime accepts — so security is not reduced beyond what the platform enforces.
 * - The iteration count is stored inside the hash (pbkdf2-sha256$<iters>$<salt>$<hash>),
 *   so verification always honours the count the hash was originally created with.
 * - Legacy hashes whose encoded count exceeds the Workers cap cannot be derived
 *   with WebCrypto; verifyPassword() returns `false` (a normal "invalid
 *   credentials" outcome) for them instead of throwing, so logins never 500.
 *   Such accounts must be re-issued a password out-of-band (a pure-JS
 *   re-derivation at 210k iterations takes ~3s of CPU and would itself exceed
 *   the Worker CPU budget).
 * - needsRehash() + the login flow transparently upgrade any *verifiable* hash
 *   that is not at the current iteration count, the moment its password checks out.
 */

export const PBKDF2_ITERATIONS = 100000;
export const MAX_PBKDF2_WORKERS_ITERATIONS = 100000;

async function derivePbkdf2(password, salt, iterations) {
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']),
    256
  ));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  if (!stored.startsWith('pbkdf2-sha256$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  let salt, expected;
  try {
    salt = unb64(parts[2]);
    expected = unb64(parts[3]);
  } catch {
    return false; // corrupted salt/hash — treat as invalid credentials
  }
  if (!salt.length || !expected.length) return false;

  if (iterations > MAX_PBKDF2_WORKERS_ITERATIONS) {
    // Legacy hash with an iteration count Workers' WebCrypto refuses to run.
    // It cannot be verified here: return a normal auth failure, never a 500.
    return false;
  }

  let actual;
  try {
    actual = await derivePbkdf2(password, salt, iterations);
  } catch {
    // WebCrypto rejected the parameters — report invalid credentials, not a 500.
    return false;
  }

  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** True when a hash is verifiable but not at the current iteration count —
 *  the login flow re-hashes it after a successful password check (routes/auth.js).
 *  Never true for unverifiable legacy hashes (iterations above the Workers cap). */
export function needsRehash(stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('pbkdf2-sha256$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  return Number.isInteger(iterations) &&
    iterations > 0 &&
    iterations <= MAX_PBKDF2_WORKERS_ITERATIONS &&
    iterations !== PBKDF2_ITERATIONS;
}

export function randomToken(bytes = 24) { return b64url(crypto.getRandomValues(new Uint8Array(bytes))); }

/**
 * SHA-256 بصيغة hex — لتخزين Reset Tokens كبصمات فقط.
 * لا يُخزَّن التوكن الخام في قاعدة البيانات أبداً؛ يُخزَّن هذا الهاش،
 * ويُهاش التوكن القادم في الطلب ويُقارن — تسريب قاعدة البيانات لا يكشف روابط إعادة التعيين.
 */
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** مقارنة ثابتة الزمن (constant-time) لسلسلتين hex — تمنع هجمات التوقيت على مقارنة التوكنات. */
export function secureCompareHex(a, b) {
  const x = String(a || ''); const y = String(b || '');
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

