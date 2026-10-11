// Central configuration.
// Secrets can be overridden through environment variables; the fallbacks keep
// the assignment runnable out-of-the-box and MUST NOT be used in production.
export const JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-do-not-use-in-production';
export const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET || 'test-webhook-secret-key';

// Business limits
export const MAX_PAYMENT_AMOUNT = 50000; // per transaction
