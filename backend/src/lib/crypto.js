
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

// PBKDF2 is constant-time and Worker-safe; bcrypt cost 12 is intentionally avoided to prevent CPU limit issues.
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']), 256));
  const hash = bits;
  return `pbkdf2-sha256$210000$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith('pbkdf2-sha256$')) {
    const [, iters, saltB64, hashB64] = stored.split('$');
    const salt = unb64(saltB64);
    const expected = unb64(hashB64);
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: Number(iters), hash: 'SHA-256' }, await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']), 256));
    if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
  }
  return false;
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

