import { createApp } from '../../app.js';
import { signPayload } from '../../utils/webhook-signature.js';

/**
 * Starts the real app on a random free port (no need to run `npm start`).
 * Every test file runs in its own process (node:test), so each gets a fresh DB.
 */
export async function startServer() {
  const { app, httpServer, io } = createApp();
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  const close = () =>
    new Promise((resolve) => {
      io.close(); // also closes the http server
      httpServer.closeAllConnections?.();
      resolve();
    });

  return { app, io, baseUrl, close };
}

export async function api(baseUrl, path, { method = 'GET', token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    h['Content-Type'] = h['Content-Type'] || 'application/json';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h['Content-Type'] = 'application/json';
  }
  const res = await fetch(baseUrl + path, { method, headers: h, body: payload });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body: json };
}

export async function loginAndGetToken(baseUrl, email = 'merchant@test.com', password = 'Test123!') {
  const res = await api(baseUrl, '/api/auth/login', { method: 'POST', body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

export async function registerAndGetToken(baseUrl, email, business_name = 'Other Co') {
  const res = await api(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: { email, password: 'SecurePass123!', business_name },
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, id: res.body.user.id };
}

// Sends a correctly signed webhook (signature computed over the exact bytes sent)
export function signedWebhook(baseUrl, path, payload) {
  const raw = JSON.stringify(payload);
  return api(baseUrl, path, {
    method: 'POST',
    raw,
    headers: { 'x-webhook-signature': signPayload(raw) },
  });
}
