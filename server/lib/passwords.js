import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const HASH_ALGORITHM = 'sha256';
const HASH_PREFIX = 'pbkdf2_sha256';
const ITERATIONS = 310_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH).toString('base64url');
  const hash = pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LENGTH, HASH_ALGORITHM).toString('base64url');

  return `${HASH_PREFIX}$${ITERATIONS}$${salt}$${hash}`;
}

export function isPasswordHash(value) {
  return String(value || '').startsWith(`${HASH_PREFIX}$`);
}

export function verifyPassword(password, storedPassword) {
  const stored = String(storedPassword || '');
  if (!stored) return false;

  if (!isPasswordHash(stored)) {
    return stored === String(password);
  }

  const [prefix, iterations, salt, expectedHash] = stored.split('$');
  if (prefix !== HASH_PREFIX || !iterations || !salt || !expectedHash) return false;

  const actualHash = pbkdf2Sync(
    String(password),
    salt,
    Number(iterations),
    KEY_LENGTH,
    HASH_ALGORITHM
  );
  const expectedHashBuffer = Buffer.from(expectedHash, 'base64url');

  if (actualHash.length !== expectedHashBuffer.length) return false;
  return timingSafeEqual(actualHash, expectedHashBuffer);
}
