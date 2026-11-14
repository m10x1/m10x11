import test from 'node:test';
import assert from 'node:assert/strict';

// Dummy in-memory values so tests never depend on a user's real .env file.
Object.assign(process.env, {
  NODE_ENV: 'test',
  FRONTEND_ORIGIN: 'http://127.0.0.1:5500',
  BACKEND_URL: 'http://localhost:4000',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-not-a-real-key',
  DATA_ENCRYPTION_KEY: '11'.repeat(32),
  CODE_HASH_KEY: '22'.repeat(32),
  SQL_SERVER: 'example.invalid',
  SQL_DATABASE: 'Mr10xMail',
  SQL_USER: 'test',
  SQL_PASSWORD: 'test-only'
});

const {randomToken, sha256, encrypt, decrypt, digestCode, safeCompare} = await import('../src/security.js');

test('secure random delivery tokens have the expected 256-bit length', () => {
  const first = randomToken();
  const second = randomToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test('sensitive payloads are encrypted and authenticated', () => {
  const plaintext = 'test-account@example.com';
  const cipher = encrypt(plaintext);
  assert.notEqual(cipher, plaintext);
  assert.equal(decrypt(cipher), plaintext);
  const corrupted = Buffer.from(cipher, 'base64');
  corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => decrypt(corrupted.toString('base64')));
});

test('hash and keyed digest are stable and distinct', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(digestCode('order-1','123456'), digestCode('order-2','123456'));
  assert.ok(safeCompare('matching', 'matching'));
  assert.ok(!safeCompare('matching', 'different'));
});
