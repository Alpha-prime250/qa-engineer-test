import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/database.js';
import { startServer, api, loginAndGetToken, registerAndGetToken, signedWebhook } from './_helpers.js';

let srv, token;
before(async () => {
  srv = await startServer();
  token = await loginAndGetToken(srv.baseUrl);
});
after(async () => { await srv.close(); });

const SIRET = '12345678901234';
const submit = (body, tok = token) => api(srv.baseUrl, '/api/einvoice/submit', { method: 'POST', token: tok, body });
const status = (id, tok = token) => api(srv.baseUrl, `/api/einvoice/status/${id}`, { token: tok });

test('submits an invoice and status becomes "submitted"', async () => {
  const res = await submit({ invoice_id: 'inv-1', customer_siret: SIRET });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.submission_id.startsWith('SUB-'));
  const st = await status('inv-1');
  assert.strictEqual(st.body.data.einvoice_status, 'submitted');
});

test('Bug G: submitting the same invoice twice returns 409 and keeps the first submission_id', async () => {
  const first = await submit({ invoice_id: 'inv-dup', customer_siret: SIRET });
  assert.strictEqual(first.status, 200);
  const second = await submit({ invoice_id: 'inv-dup', customer_siret: SIRET });
  assert.strictEqual(second.status, 409);
  const st = await status('inv-dup');
  assert.strictEqual(st.body.data.submission_id, first.body.data.submission_id);
});

test('Bug G: an "accepted" invoice cannot be re-submitted', async () => {
  await submit({ invoice_id: 'inv-acc', customer_siret: SIRET });
  await signedWebhook(srv.baseUrl, '/api/webhooks/e-invoice', { invoice_id: 'inv-acc', status: 'accepted', submission_id: 'S1' });
  const again = await submit({ invoice_id: 'inv-acc', customer_siret: SIRET });
  assert.strictEqual(again.status, 409);
});

test('Bug G: a "rejected" invoice may be corrected and re-submitted', async () => {
  await submit({ invoice_id: 'inv-rej', customer_siret: SIRET });
  await signedWebhook(srv.baseUrl, '/api/webhooks/e-invoice', { invoice_id: 'inv-rej', status: 'rejected' });
  const again = await submit({ invoice_id: 'inv-rej', customer_siret: SIRET });
  assert.strictEqual(again.status, 200);
});

test('Bug G: concurrent submissions of one invoice succeed exactly once', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => submit({ invoice_id: 'inv-race', customer_siret: SIRET })));
  assert.strictEqual(results.filter((r) => r.status === 200).length, 1);
  assert.strictEqual(results.filter((r) => r.status === 409).length, 7);
});

test('invalid SIRET is rejected AND leaves no draft invoice behind', async () => {
  for (const siret of ['123', '1234567890123a', 'abcdefghijklmn', '123456789012345', undefined, 12345678901234]) {
    const res = await submit({ invoice_id: 'inv-bad', customer_siret: siret });
    assert.strictEqual(res.status, 400, String(siret));
  }
  assert.ok(!db.invoices.some((i) => i.id === 'inv-bad'), 'no side effects on validation failure');
  assert.strictEqual((await status('inv-bad')).status, 404);
});

test('requires invoice_id and authentication', async () => {
  assert.strictEqual((await submit({ customer_siret: SIRET })).status, 400);
  const noAuth = await api(srv.baseUrl, '/api/einvoice/submit', { method: 'POST', body: { invoice_id: 'x', customer_siret: SIRET } });
  assert.strictEqual(noAuth.status, 401);
});

test('another merchant cannot submit or read my invoice (403)', async () => {
  await submit({ invoice_id: 'inv-private', customer_siret: SIRET });
  const other = await registerAndGetToken(srv.baseUrl, 'einv-other@merchant.com');
  assert.strictEqual((await submit({ invoice_id: 'inv-private', customer_siret: SIRET }, other.token)).status, 403);
  assert.strictEqual((await status('inv-private', other.token)).status, 403);
});

test('status of an unknown invoice returns 404', async () => {
  assert.strictEqual((await status('missing')).status, 404);
});
