# Fixes

All 7 documented bugs (A–G) and 9 additional issues (H–P) are fixed. No endpoint path, method, or success-response shape was changed. Behaviour changes are limited to inputs that were previously accepted incorrectly (documented per fix).

Run `npm test` → **64 tests, all passing**. As a sanity check I re-introduced each of the 7 bugs one at a time and confirmed that the tests fail (19 failures), so the tests really guard the fixes.

## Structural changes (needed for testing)

| File | Change | Why |
|------|--------|-----|
| `src/app.js` (new) | `createApp()` builds Express + Socket.IO without listening | Tests start the real app on a random port |
| `src/server.js` | Now only calls `createApp()` + `listen()` | Same runtime behaviour |
| `src/config.js` (new) | `JWT_SECRET`, `WEBHOOK_SECRET` (env-overridable), `MAX_PAYMENT_AMOUNT` | Secret was duplicated in two files; limit in one place |
| `src/utils/validators.js` (new) | `validateEmail`, `normalizeEmail`, `parseAmount` | Shared by auth and payments |
| `src/utils/webhook-signature.js` (new) | HMAC verify + middleware + `signPayload` | Shared by both webhooks |
| `package.json` | `"test": "node --test"` | The old glob `src/**/*.test.js` is not expanded recursively by `sh`, so nested test files were not found |

## Fix 1 — Bug A: amount as number
**Files:** `src/routes/payment.routes.js`
```diff
-      amount: p.amount.toString(), // ← BUG: Should be number, not string
+      amount: Number(p.amount),
-        amount: payment.amount.toString(), // Same bug as above
+        amount: Number(payment.amount),
```
**Why:** JSON consumers need a number; also makes list/detail/create responses consistent.
**Test:** `curl /api/payments -H "Authorization: Bearer $T"` → `"amount":25.5`.

## Fix 2 — Bug B (+ Bug I): maximum amount and strict amount parsing
**Files:** `src/routes/payment.routes.js`, `src/utils/validators.js`, `src/config.js`
```diff
-    if (!amount || isNaN(amount) || amount <= 0) {
+    const parsedAmount = parseAmount(amount);
+    if (parsedAmount === null || parsedAmount <= 0) {
       return res.status(400).json({ error: 'Valid amount is required ...' });
     }
+    if (parsedAmount > MAX_PAYMENT_AMOUNT) {          // 50000
+      return res.status(400).json({ error: 'Amount exceeds the maximum allowed per transaction (50000)' });
+    }
```
**Why:** `parseAmount` accepts only finite numbers/numeric strings with ≤2 decimals (rejects `true`, arrays, `Infinity`, `10.999`). Boundary: exactly 50,000 is allowed. Error text contains "maximum" as in the README example.
**Behaviour change:** amounts with >2 decimals are now rejected (money has cents).

## Fix 3 — Bug C: email validation
**Files:** `src/utils/validators.js`, `src/routes/auth.routes.js` (re-exports `validateEmail`), `src/routes/payment.routes.js`
```diff
-  const emailRegex = /^[^\s@]+@[^\s@]+$/;
+  // local-part @ dot-separated domain labels . alphabetic TLD (>= 2 chars)
+  const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
```
**Why:** `user@domain` is not deliverable. The payment endpoint's `includes('@')` check now uses the same validator.
**Known limitation:** internationalised (non-ASCII) addresses are rejected; acceptable for this API, would need IDN handling in production.

## Fix 4 — Bug D: webhook signature verification
**Files:** `src/utils/webhook-signature.js`, `src/app.js`, `src/routes/webhook.routes.js`
```diff
-router.post('/payment-status', (req, res) => {
+router.post('/payment-status', requireWebhookSignature, (req, res) => {
```
```js
// app.js — keep the exact bytes the provider signed
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// webhook-signature.js
const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
return a.length === b.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```
**Why:** Raw-body HMAC (not `JSON.stringify(req.body)`, which can differ from the signed bytes), constant-time comparison to prevent timing attacks, length checked first because `timingSafeEqual` throws on unequal lengths, verification runs **before** any validation/DB access.
**Manual test:** `SIG=$(node scripts/sign-webhook.js "$BODY")` then `curl … -H "x-webhook-signature: $SIG" -d "$BODY"`.
**Behaviour change:** unsigned webhooks now get 401 (this is the intended fix; the README's `fake-signature` curl example now correctly fails).

## Fix 5 — Bug E: idempotency
**Files:** `src/routes/webhook.routes.js`
```diff
+    if (typeof event_id !== 'string' || event_id.trim() === '' || event_id.length > 128) return 400;
+    if (db.processed_webhooks.includes(event_id)) {
+      return res.status(200).json({ message: 'Already processed' });
+    }
     ...
     payment.status = status;
+    db.processed_webhooks.push(event_id);
```
**Why:** Duplicates return **200** (so the provider stops retrying) without side effects. The id is recorded only after success, so an event for a not-yet-existing payment (404) can be retried later. The handler is synchronous, so check-and-record is atomic in Node (verified with 10 parallel requests). With a real DB use a unique constraint / `INSERT … ON CONFLICT DO NOTHING`.
Additional hardening in the same handler (Bug P): `status` allow-list, `payment_id` normalised to string.

## Fix 6 — Bug F: duplicate table orders
**Files:** `src/routes/table-order.routes.js`
```diff
+    const existingOrder = (db.table_orders || []).find(
+      o => o.merchant_id === merchant_id &&
+           String(o.table_number) === String(table_number) &&
+           o.status === 'pending'
+    );
+    if (existingOrder) return res.status(409).json({ error: 'Table already has a pending order' });
```
**Why:** `String()` so `5` and `"5"` are one table. Once an order leaves `pending` the table can order again. Also added (Bug N): item validation, merchant existence check, total rounded to cents.

## Fix 7 — Bug G: duplicate e-invoice submission
**Files:** `src/routes/einvoice.routes.js`
```diff
+    if (invoice && (invoice.einvoice_status === 'submitted' || invoice.einvoice_status === 'accepted')) {
+      return res.status(409).json({ error: 'Invoice already submitted to tax authority' });
+    }
```
**Why:** Handler reordered to *look up → ownership → validate SIRET (`/^\d{14}$/`) → duplicate check → create/submit*, so a rejected request has no side effects (Bug M). `rejected` invoices can be corrected and re-submitted.

## Fix 8 — Extra findings H, J, K, L, O

- **H** `database.js`: seed password hashed with `bcrypt.hashSync('Test123!')`; `initDatabase()` now resets state so it is safe to call repeatedly.
- **J** `app.js` error handler: `entity.parse.failed` → `400 Malformed JSON body`; `entity.too.large` → 413.
- **K** `validators.normalizeEmail` + case-insensitive `findUserByEmail`; register/login normalise.
- **L** `table-order.routes.js`: `new_order` → room `merchant_<id>`, `order_status_changed` → rooms `table_<n>` and `merchant_<id>` using `req.app.get('io')`. Webhook also emits `payment_status_changed` (additive event).
- **O** `/api/webhooks/e-invoice` uses the same signature middleware.

## Not changed on purpose
See "Observations" in `bug-reports.md` (public `POST /table-orders`, unauthenticated socket rooms, rate limiting, state machines, replay window). These are product/architecture decisions; changing them would alter API contracts.

## Side effect to be aware of
`npm run verify-bugs` is a *"are the bugs still present"* script for the original repo, so it now reports the bugs as fixed (that is expected).
