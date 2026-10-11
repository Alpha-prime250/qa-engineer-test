#!/usr/bin/env node
/**
 * Helper for manual webhook testing: prints the HMAC-SHA256 signature for a body.
 *
 *   BODY='{"payment_id":"2","status":"completed","event_id":"evt_1"}'
 *   SIG=$(node scripts/sign-webhook.js "$BODY")
 *   curl -X POST localhost:3000/api/webhooks/payment-status \
 *     -H "Content-Type: application/json" -H "x-webhook-signature: $SIG" -d "$BODY"
 *
 * The body must be sent byte-for-byte as signed (use -d "$BODY", not a re-formatted JSON).
 */
import { signPayload } from "../src/utils/webhook-signature.js";

const body = process.argv[2];
if (!body) {
  console.error("Usage: node scripts/sign-webhook.js '<raw json body>'");
  process.exit(1);
}
console.log(signPayload(body));
