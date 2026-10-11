import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { startServer, api, loginAndGetToken, registerAndGetToken } from './_helpers.js';

let srv, token;
before(async () => {
  srv = await startServer();
  token = await loginAndGetToken(srv.baseUrl);
});
after(async () => { await srv.close(); });

const createPayment = (body, tok = token) =>
  api(srv.baseUrl, '/api/payments', { method: 'POST', token: tok, body });
const valid = { amount: 50, currency: 'EUR', customer_email: 'customer@example.com' };

// ---------- Bug A ----------
test('Bug A: GET /payments returns amount as a number', async () => {
  const res = await api(srv.baseUrl, '/api/payments', { token });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.length >= 2);
  for (const p of res.body.data) assert.strictEqual(typeof p.amount, 'number');
  assert.strictEqual(res.body.data[0].amount, 25.5);
  assert.strictEqual(res.body.count, res.body.data.length);
});

test('Bug A: GET /payments/:id returns amount as a number', async () => {
  const res = await api(srv.baseUrl, '/api/payments/2', { token });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(typeof res.body.data.amount, 'number');
  assert.strictEqual(res.body.data.amount, 100);
});

test('Bug A: amounts can be summed numerically (no string concatenation)', async () => {
  const res = await api(srv.baseUrl, '/api/payments', { token });
  const sum = res.body.data.reduce((s, p) => s + p.amount, 0);
  assert.strictEqual(typeof sum, 'number');
  assert.ok(Number.isFinite(sum));
});

// ---------- Bug B ----------
test('Bug B: rejects amount over the €50,000 maximum', async () => {
  for (const amount of [50000.01, 999999, 999999999]) {
    const res = await createPayment({ ...valid, amount });
    assert.strictEqual(res.status, 400, String(amount));
    assert.ok(res.body.error.includes('maximum'));
  }
});

test('Bug B: boundary - exactly €50,000 is accepted', async () => {
  const res = await createPayment({ ...valid, amount: 50000 });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.amount, 50000);
});

test('POST /payments with valid data creates a pending payment visible in the list', async () => {
  const res = await createPayment(valid);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.status, 'pending');
  assert.strictEqual(typeof res.body.data.amount, 'number');
  const list = await api(srv.baseUrl, '/api/payments', { token });
  assert.ok(list.body.data.some((p) => p.id === res.body.data.id));
});

test('POST /payments accepts numeric-string amount and stores a number', async () => {
  const res = await createPayment({ ...valid, amount: '12.34' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.amount, 12.34);
});

test('POST /payments rejects zero, negative and non-numeric amounts', async () => {
  for (const amount of [0, -50, 'abc', '', null, undefined, true, [5], {}, 'Infinity', 1e999]) {
    const res = await createPayment({ ...valid, amount });
    assert.strictEqual(res.status, 400, `amount=${JSON.stringify(amount)}`);
  }
});

test('POST /payments rejects more than 2 decimal places', async () => {
  const res = await createPayment({ ...valid, amount: 10.999 });
  assert.strictEqual(res.status, 400);
});

test('POST /payments rejects unsupported currency', async () => {
  const res = await createPayment({ ...valid, currency: 'XYZ' });
  assert.strictEqual(res.status, 400);
});

test('POST /payments rejects invalid customer email (incl. no TLD)', async () => {
  for (const customer_email of ['', 'nope', 'a@b', undefined]) {
    const res = await createPayment({ ...valid, customer_email });
    assert.strictEqual(res.status, 400, String(customer_email));
  }
});

test('POST /payments without authentication returns 401', async () => {
  const res = await api(srv.baseUrl, '/api/payments', { method: 'POST', body: valid });
  assert.strictEqual(res.status, 401);
});

// ---------- Authorization / isolation ----------
test('merchant cannot read or list another merchant\'s payments', async () => {
  const other = await registerAndGetToken(srv.baseUrl, 'other@merchant.com');
  const list = await api(srv.baseUrl, '/api/payments', { token: other.token });
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.count, 0);
  const single = await api(srv.baseUrl, '/api/payments/1', { token: other.token });
  assert.strictEqual(single.status, 403);
});

test('GET /payments/:id returns 404 for unknown payment', async () => {
  const res = await api(srv.baseUrl, '/api/payments/does-not-exist', { token });
  assert.strictEqual(res.status, 404);
});
