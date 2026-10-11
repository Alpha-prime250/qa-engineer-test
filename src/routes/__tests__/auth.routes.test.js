import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { validateEmail } from '../auth.routes.js';
import { startServer, api, loginAndGetToken } from './_helper.js';

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

// ---------- Unit tests: Bug C (email validation) ----------
test('Bug C (unit): validateEmail accepts well-formed addresses', () => {
  for (const e of ['a@b.co', 'john.doe+tag@sub.example.com', 'USER@EXAMPLE.EU']) {
    assert.strictEqual(validateEmail(e), true, e);
  }
});

test('Bug C (unit): validateEmail rejects addresses without a TLD', () => {
  assert.strictEqual(validateEmail('user@domain'), false);
});

test('Bug C (unit): validateEmail rejects malformed addresses', () => {
  const bad = ['', 'plain', '@domain.com', 'user@', 'user@@domain.com', 'a b@domain.com',
    'user@domain.', 'user@.com', 'user@domain.c', null, undefined, 42, {}];
  for (const e of bad) assert.strictEqual(validateEmail(e), false, String(e));
});

// ---------- API tests ----------
test('Bug C (API): register rejects "user@domain" with 400', async () => {
  const res = await api(srv.baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email: 'user@domain', password: 'SecurePass123!', business_name: 'Test Co' },
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /email/i);
});

test('register succeeds with valid data and returns a JWT (no password leak)', async () => {
  const res = await api(srv.baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email: 'new@merchant.com', password: 'SecurePass123!', business_name: 'New Co' },
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.token);
  assert.strictEqual(res.body.user.email, 'new@merchant.com');
  assert.strictEqual(res.body.user.password, undefined);
});

test('register rejects short password, missing/short business name', async () => {
  const short = await api(srv.baseUrl, '/api/auth/register', {
    method: 'POST', body: { email: 'p@x.com', password: '123', business_name: 'Co' } });
  assert.strictEqual(short.status, 400);
  const noName = await api(srv.baseUrl, '/api/auth/register', {
    method: 'POST', body: { email: 'p@x.com', password: 'SecurePass123!' } });
  assert.strictEqual(noName.status, 400);
});

test('register rejects duplicate email, case-insensitively (409)', async () => {
  const body = { password: 'SecurePass123!', business_name: 'Dup Co' };
  const first = await api(srv.baseUrl, '/api/auth/register', { method: 'POST', body: { ...body, email: 'dup@x.com' } });
  assert.strictEqual(first.status, 201);
  const second = await api(srv.baseUrl, '/api/auth/register', { method: 'POST', body: { ...body, email: 'DUP@X.com' } });
  assert.strictEqual(second.status, 409);
});

test('login works for the seeded test merchant (merchant@test.com / Test123!)', async () => {
  const res = await api(srv.baseUrl, '/api/auth/login', {
    method: 'POST', body: { email: 'merchant@test.com', password: 'Test123!' } });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
});

test('login is case-insensitive on email', async () => {
  const res = await api(srv.baseUrl, '/api/auth/login', {
    method: 'POST', body: { email: 'MERCHANT@Test.com', password: 'Test123!' } });
  assert.strictEqual(res.status, 200);
});

test('login rejects wrong password and unknown user with the same generic 401', async () => {
  const wrongPw = await api(srv.baseUrl, '/api/auth/login', {
    method: 'POST', body: { email: 'merchant@test.com', password: 'nope' } });
  const unknown = await api(srv.baseUrl, '/api/auth/login', {
    method: 'POST', body: { email: 'ghost@test.com', password: 'Test123!' } });
  assert.strictEqual(wrongPw.status, 401);
  assert.strictEqual(unknown.status, 401);
  assert.deepStrictEqual(wrongPw.body, unknown.body); // no user enumeration
});

test('login with missing fields returns 400', async () => {
  const res = await api(srv.baseUrl, '/api/auth/login', { method: 'POST', body: { email: 'merchant@test.com' } });
  assert.strictEqual(res.status, 400);
});

test('malformed JSON body returns 400 (was a generic 500)', async () => {
  const res = await api(srv.baseUrl, '/api/auth/login', { method: 'POST', raw: '{bad json' });
  assert.strictEqual(res.status, 400);
});

test('protected route: missing / invalid / tampered token returns 401', async () => {
  const none = await api(srv.baseUrl, '/api/payments');
  assert.strictEqual(none.status, 401);
  const junk = await api(srv.baseUrl, '/api/payments', { token: 'not.a.jwt' });
  assert.strictEqual(junk.status, 401);
  const good = await loginAndGetToken(srv.baseUrl);
  const tampered = good.slice(0, -2) + (good.endsWith('aa') ? 'bb' : 'aa');
  const res = await api(srv.baseUrl, '/api/payments', { token: tampered });
  assert.strictEqual(res.status, 401);
});
