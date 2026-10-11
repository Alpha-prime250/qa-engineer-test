import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/database.js';
import { startServer, api, signedWebhook } from './_helper.js';

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

const PATH = '/api/webhooks/payment-status';
const payment = (id) => db.payments.find((p) => p.id === id);

// ---------- Bug D: signature verification ----------
test('Bug D: webhook without signature header is rejected (401) and changes nothing', async () => {
  const res = await api(srv.baseUrl, PATH, {
    method: 'POST', body: { payment_id: '2', status: 'completed', event_id: 'evt_nosig' } });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(payment('2').status, 'pending');
});

test('Bug D: webhook with forged signature (README "fake-signature") is rejected', async () => {
  const res = await api(srv.baseUrl, PATH, {
    method: 'POST',
    headers: { 'x-webhook-signature': 'fake-signature' },
    body: { payment_id: '2', status: 'completed', event_id: 'evt_fake' } });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(payment('2').status, 'pending');
});

test('Bug D: signature of a different payload (tampered body) is rejected', async () => {
  const { signPayload } = await import('../../utils/webhook-signature.js');
  const signedFor = JSON.stringify({ payment_id: '2', status: 'failed', event_id: 'evt_t' });
  const sent = JSON.stringify({ payment_id: '2', status: 'completed', event_id: 'evt_t' });
  const res = await api(srv.baseUrl, PATH, {
    method: 'POST', raw: sent, headers: { 'x-webhook-signature': signPayload(signedFor) } });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(payment('2').status, 'pending');
});

test('Bug D: signature of correct length but wrong value / wrong length does not crash', async () => {
  for (const sig of ['0'.repeat(64), 'abc', '']) {
    const res = await api(srv.baseUrl, PATH, {
      method: 'POST', headers: { 'x-webhook-signature': sig },
      body: { payment_id: '2', status: 'completed', event_id: 'evt_len' } });
    assert.strictEqual(res.status, 401, sig);
  }
});

test('Bug D: correctly signed webhook updates the payment status', async () => {
  const res = await signedWebhook(srv.baseUrl, PATH,
    { payment_id: '2', status: 'completed', event_id: 'evt_valid_1' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.new_status, 'completed');
  assert.strictEqual(payment('2').status, 'completed');
  assert.ok(payment('2').webhook_received_at);
});

// ---------- Bug E: idempotency ----------
test('Bug E: duplicate event_id is acknowledged but processed only once', async () => {
  const payload = { payment_id: '1', status: 'refunded', event_id: 'evt_dup' };
  const first = await signedWebhook(srv.baseUrl, PATH, payload);
  assert.strictEqual(first.status, 200);
  assert.strictEqual(payment('1').status, 'refunded');
  const firstTs = payment('1').webhook_received_at;

  // Simulate a later state, then provider re-delivers the OLD event
  payment('1').status = 'completed';
  const second = await signedWebhook(srv.baseUrl, PATH, payload);
  assert.strictEqual(second.status, 200);
  assert.strictEqual(second.body.message, 'Already processed');
  assert.strictEqual(payment('1').status, 'completed', 'replay must not overwrite state');
  assert.strictEqual(payment('1').webhook_received_at, firstTs);
  assert.strictEqual(db.processed_webhooks.filter((e) => e === 'evt_dup').length, 1);
});

test('Bug E: concurrent identical webhooks are applied exactly once', async () => {
  const payload = { payment_id: '2', status: 'failed', event_id: 'evt_race' };
  const results = await Promise.all(Array.from({ length: 10 }, () => signedWebhook(srv.baseUrl, PATH, payload)));
  assert.ok(results.every((r) => r.status === 200));
  assert.strictEqual(results.filter((r) => r.body.message === 'Already processed').length, 9);
  assert.strictEqual(db.processed_webhooks.filter((e) => e === 'evt_race').length, 1);
});

test('different event_ids for the same payment are each processed', async () => {
  const a = await signedWebhook(srv.baseUrl, PATH, { payment_id: '2', status: 'processing', event_id: 'evt_a' });
  const b = await signedWebhook(srv.baseUrl, PATH, { payment_id: '2', status: 'completed', event_id: 'evt_b' });
  assert.strictEqual(a.status, 200);
  assert.strictEqual(b.status, 200);
  assert.strictEqual(payment('2').status, 'completed');
});

test('event for a non-existent payment returns 404 and is NOT marked processed (can be retried)', async () => {
  const payload = { payment_id: '9999', status: 'completed', event_id: 'evt_early' };
  const res = await signedWebhook(srv.baseUrl, PATH, payload);
  assert.strictEqual(res.status, 404);
  assert.ok(!db.processed_webhooks.includes('evt_early'));
});

// ---------- Payload validation ----------
test('missing fields return 400 (payment_id / status / event_id)', async () => {
  for (const p of [
    { status: 'completed', event_id: 'e1' },
    { payment_id: '1', event_id: 'e2' },
    { payment_id: '1', status: 'completed' },
    { payment_id: '1', status: 'completed', event_id: '' },
    { payment_id: '1', status: 'completed', event_id: null },
  ]) {
    const res = await signedWebhook(srv.baseUrl, PATH, p);
    assert.strictEqual(res.status, 400, JSON.stringify(p));
  }
});

test('invalid / malicious status values are rejected (XSS, unicode, unknown)', async () => {
  for (const status of ['<script>alert(1)</script>', 'paid', 'ｃｏｍｐｌｅｔｅｄ', { $ne: 1 }, ['completed']]) {
    const res = await signedWebhook(srv.baseUrl, PATH,
      { payment_id: '1', status, event_id: `evt_bad_${Math.random()}` });
    assert.strictEqual(res.status, 400, JSON.stringify(status));
  }
  assert.ok(!['<script>alert(1)</script>', 'paid'].includes(payment('1').status));
});

test('SQL-injection style payment_id is treated as plain data (404, no crash)', async () => {
  const res = await signedWebhook(srv.baseUrl, PATH,
    { payment_id: "1' OR '1'='1", status: 'completed', event_id: 'evt_sqli' });
  assert.strictEqual(res.status, 404);
});

test('malformed JSON webhook body returns 400/401, never 500', async () => {
  const raw = '{"payment_id": "1", ';
  const res = await api(srv.baseUrl, PATH, { method: 'POST', raw });
  assert.ok([400, 401].includes(res.status), String(res.status));
});

test('numeric payment_id (1 instead of "1") is accepted', async () => {
  const res = await signedWebhook(srv.baseUrl, PATH,
    { payment_id: 1, status: 'completed', event_id: 'evt_numeric' });
  assert.strictEqual(res.status, 200);
});

// ---------- Integration: webhook -> socket event ----------
test('webhook emits payment_status_changed to the merchant room', async () => {
  const emitted = [];
  const original = srv.app.get('io');
  srv.app.set('io', { to: (room) => ({ emit: (evt, data) => emitted.push({ room, evt, data }) }) });
  try {
    await signedWebhook(srv.baseUrl, PATH, { payment_id: '2', status: 'refunded', event_id: 'evt_sock' });
  } finally {
    srv.app.set('io', original);
  }
  assert.deepStrictEqual(emitted, [{
    room: 'merchant_1', evt: 'payment_status_changed', data: { payment_id: '2', status: 'refunded' } }]);
});

// ---------- e-invoice webhook (extra hardening) ----------
test('e-invoice webhook requires a valid signature', async () => {
  const res = await api(srv.baseUrl, '/api/webhooks/e-invoice', {
    method: 'POST', body: { invoice_id: 'x', status: 'accepted' } });
  assert.strictEqual(res.status, 401);
});

test('e-invoice webhook with valid signature returns 404 for unknown invoice', async () => {
  const res = await signedWebhook(srv.baseUrl, '/api/webhooks/e-invoice', { invoice_id: 'nope', status: 'accepted' });
  assert.strictEqual(res.status, 404);
});
