# Submission — QA Tester Intern, EU Pay

**Candidate:** Yash Parashar · **Email:** yashparashar473@gmail.com

**Approach.** I first ran the unmodified API and tested it with curl (happy path → negative → security → edge cases → concurrency), recording the real responses, and only then read the code to find root causes. This found all 7 documented bugs (A–G) plus 9 additional issues (seed login broken, `amount: true` stored as `NaN`, malformed JSON → 500, case-sensitive emails, unemitted Socket.IO events, SIRET validation side effects, unvalidated order items, unauthenticated e-invoice webhook, unvalidated webhook status). I fixed them without changing endpoint contracts, using the raw-body HMAC with constant-time comparison for webhooks and an idempotency key recorded after successful processing.

**Tests.** `npm test` runs 64 automated tests (Node built-in runner, real app on a random port) covering every bug plus negative, edge-case, concurrency, authorization and Socket.IO scenarios. I verified they are meaningful by re-introducing each bug and confirming the tests fail.

**Documents.** `bug-reports.md` (findings, reproduction, root cause, plus observations I deliberately did not change), `fixes.md` (diffs and reasoning), `test-plan.md` (webhook flow, security, risks).

**Run it**
```bash
npm install
npm test               # 64 tests
npm start              # http://localhost:3000
# manual signed webhook
BODY='{"payment_id":"2","status":"completed","event_id":"evt_1"}'
SIG=$(node scripts/sign-webhook.js "$BODY")
curl -X POST localhost:3000/api/webhooks/payment-status \
  -H "Content-Type: application/json" -H "x-webhook-signature: $SIG" -d "$BODY"
```

**Limitations.** In-memory DB (idempotency store resets on restart), no rate limiting, socket rooms are not authenticated, and no state machine for payment/order transitions — documented in `bug-reports.md` as follow-ups.
