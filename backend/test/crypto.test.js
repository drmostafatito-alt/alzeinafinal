import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  PBKDF2_ITERATIONS,
  MAX_PBKDF2_WORKERS_ITERATIONS
} from '../src/lib/crypto.js';

// Synthetic, non-secret test vectors only — no production credentials or hashes.
const PASSWORD = 'Synthetic-Test-P@ssw0rd-1';
const WRONG = 'Definitely-Wrong-P@ssw0rd-2';

// Builds a stored hash string in the repo's own format using Node's native
// PBKDF2 (an independent reference implementation) for a given iteration count.
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const makeStored = (password, iterations, dkLen = 32) => {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, dkLen, 'sha256');
  return `pbkdf2-sha256$${iterations}$${b64url(salt)}$${b64url(hash)}`;
};

test('new password hashing uses the Workers-supported iteration count', async () => {
  assert.equal(PBKDF2_ITERATIONS, 100000);
  assert.ok(PBKDF2_ITERATIONS <= MAX_PBKDF2_WORKERS_ITERATIONS);
  const stored = await hashPassword(PASSWORD);
  assert.ok(stored.startsWith(`pbkdf2-sha256$${PBKDF2_ITERATIONS}$`));
  assert.equal(stored.split('$').length, 4);
});

test('verification of a newly hashed correct password succeeds', async () => {
  const stored = await hashPassword(PASSWORD);
  assert.equal(await verifyPassword(PASSWORD, stored), true);
});

test('verification of a newly hashed wrong password fails', async () => {
  const stored = await hashPassword(PASSWORD);
  assert.equal(await verifyPassword(WRONG, stored), false);
});

test('verification honours the encoded iteration count when supported', async () => {
  // 60,000 iterations: within the Workers cap but not the current default.
  const stored = makeStored(PASSWORD, 60000);
  assert.equal(await verifyPassword(PASSWORD, stored), true);
  assert.equal(await verifyPassword(WRONG, stored), false);
});

test('a legacy 210000-iteration hash returns false without throwing', async () => {
  const stored = makeStored(PASSWORD, 210000);
  // Workers WebCrypto refuses counts > 100000, so this must be a clean
  // "invalid credentials" result (no exception → no HTTP 500).
  assert.equal(await verifyPassword(PASSWORD, stored), false);
  assert.equal(await verifyPassword(WRONG, stored), false);
});

test('needsRehash flags verifiable-but-outdated hashes only', async () => {
  assert.equal(needsRehash(await hashPassword(PASSWORD)), false); // current default
  assert.equal(needsRehash(makeStored(PASSWORD, 60000)), true);   // verifiable, outdated
  assert.equal(needsRehash(makeStored(PASSWORD, 210000)), false); // unverifiable → never rehash
});

test('needsRehash is false for garbage / non-PBKDF2 inputs', () => {
  assert.equal(needsRehash(null), false);
  assert.equal(needsRehash(undefined), false);
  assert.equal(needsRehash(''), false);
  assert.equal(needsRehash('bcrypt$12$whatever'), false);
  assert.equal(needsRehash('pbkdf2-sha256$notanumber$abc$def'), false);
  assert.equal(needsRehash('pbkdf2-sha256$'), false);
});

test('verifyPassword is safe on malformed / corrupted inputs', async () => {
  assert.equal(await verifyPassword(PASSWORD, null), false);
  assert.equal(await verifyPassword(PASSWORD, undefined), false);
  assert.equal(await verifyPassword(PASSWORD, ''), false);
  assert.equal(await verifyPassword(PASSWORD, 'garbage'), false);
  assert.equal(await verifyPassword(PASSWORD, 'pbkdf2-sha256$'), false);
  assert.equal(await verifyPassword(PASSWORD, 'pbkdf2-sha256$210000$!!!$!!!'), false); // bad base64
  assert.equal(await verifyPassword(PASSWORD, `pbkdf2-sha256$100000$AA$AA`), false);   // wrong-length hash
});
