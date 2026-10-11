import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { startServer, api, loginAndGetToken, registerAndGetToken } from './_helpers.js';

let srv, token;
before(async () => {
  srv = await startServer();
  token = await loginAndGetToken(srv.baseUrl);
});
after(async () => { await srv.close(); });

const order = (over = {}) => ({
  merchant_id: '1',
  table_number: 5,
  items: [{ name: 'Pizza', price: 12.5, quantity: 2 }],
  ...over,
});
const create = (body) => api(srv.baseUrl, '/api/table-orders', { method: 'POST', body });

test('creates an order and computes the total', async () => {
  const res = await create(order({ table_number: 1, items: [{ price: 12.5, quantity: 2 }, { price: 0.1, quantity: 3 }] }));
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.status, 'pending');
  assert.strictEqual(res.body.data.total, 25.3); // no 25.300000000000004 float artefact
});

test('Bug F: second order for a table with a pending order is rejected (409)', async () => {
  const first = await create(order({ table_number: 7 }));
  assert.strictEqual(first.status, 201);
  const dup = await create(order({ table_number: 7 }));
  assert.strictEqual(dup.status, 409);
  const list = await api(srv.baseUrl, '/api/table-orders', { token });
  assert.strictEqual(list.body.data.filter((o) => String(o.table_number) === '7').length, 1);
});

test('Bug F: table 7 and "7" are the same table', async () => {
  const dup = await create(order({ table_number: '7' }));
  assert.strictEqual(dup.status, 409);
});

test('Bug F: different tables are independent', async () => {
  const res = await create(order({ table_number: 8 }));
  assert.strictEqual(res.status, 201);
});

test('Bug F: simultaneous requests for the same table create only one order', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => create(order({ table_number: 99 }))));
  assert.strictEqual(results.filter((r) => r.status === 201).length, 1);
  assert.strictEqual(results.filter((r) => r.status === 409).length, 7);
});

test('Bug F: after the order leaves "pending" the table can order again', async () => {
  const first = await create(order({ table_number: 20 }));
  const patch = await api(srv.baseUrl, `/api/table-orders/${first.body.data.id}/status`,
    { method: 'PATCH', token, body: { status: 'served' } });
  assert.strictEqual(patch.status, 200);
  const again = await create(order({ table_number: 20 }));
  assert.strictEqual(again.status, 201);
});

test('rejects invalid payloads (missing fields, empty/invalid items, unknown merchant)', async () => {
  const cases = [
    [order({ merchant_id: undefined }), 400],
    [order({ table_number: undefined }), 400],
    [order({ items: 'pizza' }), 400],
    [order({ items: [] }), 400],
    [order({ table_number: 30, items: [{ price: -5, quantity: 1 }] }), 400],
    [order({ table_number: 31, items: [{ price: 5, quantity: 0 }] }), 400],
    [order({ table_number: 32, items: [{ price: 5, quantity: 1.5 }] }), 400],
    [order({ table_number: 33, items: [{ quantity: 1 }] }), 400],
    [order({ table_number: 34, merchant_id: 'ghost' }), 404],
  ];
  for (const [body, expected] of cases) {
    const res = await create(body);
    assert.strictEqual(res.status, expected, JSON.stringify(body));
  }
});

test('status update validates the value and requires auth', async () => {
  const created = await create(order({ table_number: 40 }));
  const id = created.body.data.id;
  const noAuth = await api(srv.baseUrl, `/api/table-orders/${id}/status`, { method: 'PATCH', body: { status: 'ready' } });
  assert.strictEqual(noAuth.status, 401);
  const bad = await api(srv.baseUrl, `/api/table-orders/${id}/status`, { method: 'PATCH', token, body: { status: 'exploded' } });
  assert.strictEqual(bad.status, 400);
  const ok = await api(srv.baseUrl, `/api/table-orders/${id}/status`, { method: 'PATCH', token, body: { status: 'preparing' } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.data.status, 'preparing');
});

test('another merchant cannot change my order status (403) and 404 for unknown id', async () => {
  const created = await create(order({ table_number: 41 }));
  const other = await registerAndGetToken(srv.baseUrl, 'rival@merchant.com');
  const res = await api(srv.baseUrl, `/api/table-orders/${created.body.data.id}/status`,
    { method: 'PATCH', token: other.token, body: { status: 'cancelled' } });
  assert.strictEqual(res.status, 403);
  const missing = await api(srv.baseUrl, '/api/table-orders/nope/status',
    { method: 'PATCH', token, body: { status: 'ready' } });
  assert.strictEqual(missing.status, 404);
});

test('GET /table-orders only lists the authenticated merchant\'s orders', async () => {
  const other = await registerAndGetToken(srv.baseUrl, 'third@merchant.com');
  const mine = await api(srv.baseUrl, '/api/table-orders', { token });
  const theirs = await api(srv.baseUrl, '/api/table-orders', { token: other.token });
  assert.ok(mine.body.count > 0);
  assert.strictEqual(theirs.body.count, 0);
});

// ---------- Socket.IO events ----------
test('new_order is emitted to the merchant room; order_status_changed to the table room', async () => {
  const emitted = [];
  const original = srv.app.get('io');
  const chain = (rooms) => ({
    to: (r) => chain([...rooms, r]),
    emit: (evt, data) => emitted.push({ rooms, evt, data }),
  });
  srv.app.set('io', { to: (r) => chain([r]) });
  try {
    const created = await create(order({ table_number: 50 }));
    await api(srv.baseUrl, `/api/table-orders/${created.body.data.id}/status`,
      { method: 'PATCH', token, body: { status: 'ready' } });
  } finally {
    srv.app.set('io', original);
  }
  const newOrder = emitted.find((e) => e.evt === 'new_order');
  assert.deepStrictEqual(newOrder.rooms, ['merchant_1']);
  const changed = emitted.find((e) => e.evt === 'order_status_changed');
  assert.ok(changed.rooms.includes('table_50'));
  assert.strictEqual(changed.data.status, 'ready');
  assert.strictEqual(changed.data.table_number, 50);
});
