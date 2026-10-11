// Shared input validators

// Requires: local part, "@", domain labels and a TLD of 2+ letters.
// (Bug C fix: the old regex accepted "user@domain" - no TLD.)
const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

// Normalise emails so "User@Example.com" and "user@example.com" are one account
export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

/**
 * Parse a monetary amount. Accepts numbers or numeric strings only
 * (booleans, arrays, objects, NaN, Infinity are rejected) and at most
 * 2 decimal places. Returns a number or null when invalid.
 */
export function parseAmount(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (Math.round(n * 100) / 100 !== n) return null; // > 2 decimals
  return n;
}
