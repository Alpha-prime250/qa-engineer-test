import crypto from 'crypto';
import { WEBHOOK_SECRET } from '../config.js';

/**
 * Verify an HMAC-SHA256 webhook signature (hex) over the RAW request body.
 * Uses a constant-time comparison to avoid timing attacks.
 */
export function verifySignature(rawBody, signature) {
  if (!rawBody || typeof signature !== 'string' || signature.length === 0) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual throws on different lengths -> check first
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express middleware: rejects the request with 401 unless signature is valid
export function requireWebhookSignature(req, res, next) {
  if (!verifySignature(req.rawBody, req.headers['x-webhook-signature'])) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
}

// Helper used by tests / simulators to sign a payload string
export function signPayload(rawBody) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}
