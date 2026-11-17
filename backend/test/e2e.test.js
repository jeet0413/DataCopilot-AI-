// End-to-end test: real Express app + real FastAPI AI service + real PostgreSQL.
// Requires: TEST_PYTHON (python with ai-service deps) and TEST_DATABASE_URL. Skipped otherwise.
// No HUGGINGFACE_API_KEY is set, so the AI service uses its rule-based fallbacks (no network).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PYTHON = process.env.TEST_PYTHON;
const DB = process.env.TEST_DATABASE_URL;
const skip = !PYTHON || !DB ? 'set TEST_PYTHON and TEST_DATABASE_URL to run' : false;

const AI_PORT = 18001;
let aiProc;
let server;
let base;

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x'.repeat(48);
process.env.AI_SERVICE_TOKEN = 'e2e-shared-secret';
process.env.AI_SERVICE_URL = `http://127.0.0.1:${AI_PORT}`;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const CSV = 'Order Date,Category,Total $\n2024-01-05,Electronics,100.5\n2024-01-06,Electronics,200\n2024-02-01,Furniture,50\n2024-02-02,Furniture,75.25\n';

async function waitForAI() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${AI_PORT}/health`);
      if (r.ok || r.status === 200) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('AI service did not start');
}

before(async () => {
  if (skip) return;
  aiProc = spawn(PYTHON, ['app.py'], {
    cwd: path.join(__dirname, '..', '..', 'ai-service'),
    env: { ...process.env, DATABASE_URL: DB, AI_SERVICE_PORT: String(AI_PORT), HUGGINGFACE_API_KEY: '' },
    stdio: 'ignore',
  });
  await waitForAI();
  const { createApp } = require('../server');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  if (aiProc) aiProc.kill();
});

const api = async (method, url, { token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(base + url, { method, headers, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
};

const csvForm = (csv = CSV, name = 'sales.csv') => {
  const f = new FormData();
  f.append('file', new Blob([csv], { type: 'text/csv' }), name);
  return f;
};

const register = async (email, password = 'correct-horse-battery') =>
  (await api('POST', '/api/auth/register', { json: { name: 'T', email, password } }));

test('auth: register, login, wrong password, duplicate, profile', { skip }, async () => {
  const r = await register('A@Example.com');
  assert.equal(r.status, 201);
  assert.ok(r.data.data.token);
  assert.equal(r.data.data.user.email, 'a@example.com');
  assert.equal(r.data.data.user.password_hash, undefined);

  assert.equal((await register('a@example.com')).status, 409);
  assert.equal((await api('POST', '/api/auth/register', { json: { name: 'x', email: 'b@example.com', password: 'short' } })).status, 400);

  const bad = await api('POST', '/api/auth/login', { json: { email: 'a@example.com', password: 'wrong-password' } });
  assert.equal(bad.status, 401);
  const none = await api('POST', '/api/auth/login', { json: { email: 'nobody@example.com', password: 'whatever123' } });
  assert.equal(none.status, 401);
  const ok = await api('POST', '/api/auth/login', { json: { email: 'a@example.com', password: 'correct-horse-battery' } });
  assert.equal(ok.status, 200);

  const me = await api('GET', '/api/auth/profile', { token: ok.data.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.data.email, 'a@example.com');
});

test('auth: protected routes reject missing/forged tokens', { skip }, async () => {
  for (const [m, u] of [['GET', '/api/datasets'], ['POST', '/api/upload'], ['POST', '/api/ai/query'], ['POST', '/api/ai/insights'], ['GET', '/api/download/x']]) {
    assert.equal((await api(m, u)).status, 401, `${m} ${u}`);
    assert.equal((await api(m, u, { token: 'forged.token.value' })).status, 403, `${m} ${u} forged`);
  }
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ userId: 'x', email: 'x' }, 'not-the-secret');
  assert.equal((await api('GET', '/api/datasets', { token: forged })).status, 403);
  assert.equal((await api('GET', '/uploads/anything.csv')).status, 404, 'uploads must not be served statically');
});

test('full flow: upload -> list -> query -> insights -> download -> delete, with user isolation', { skip }, async () => {
  const a = (await register('owner@example.com')).data.data.token;
  const b = (await register('other@example.com')).data.data.token;

  const up = await api('POST', '/api/upload', { token: a, form: csvForm() });
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const ds = up.data.data;
  assert.equal(ds.row_count, 4);
  assert.deepEqual(ds.columns.map((c) => c.name), ['order_date', 'category', 'total']);
  assert.equal(ds.table_name, undefined, 'physical table name must not leak');

  const list = await api('GET', '/api/datasets', { token: a });
  assert.equal(list.data.data.length, 1);
  assert.equal((await api('GET', '/api/datasets', { token: b })).data.data.length, 0);

  const q = await api('POST', '/api/ai/query', { token: a, json: { dataset_id: ds.id, user_query: 'what is the total sum' } });
  assert.equal(q.status, 200, JSON.stringify(q.data));
  assert.equal(q.data.data.data[0].total_sum, 425.75);
  assert.equal(q.data.data.schema_used, undefined);
  assert.match(q.data.data.sql_query, /SUM\("total"\)/i);

  const cnt = await api('POST', '/api/ai/query', { token: a, json: { dataset_id: ds.id, user_query: 'how many rows' } });
  assert.equal(cnt.data.data.data[0].total_records, 4);

  const ins = await api('POST', '/api/ai/insights', { token: a, json: { dataset_id: ds.id } });
  assert.equal(ins.status, 200);
  assert.ok(ins.data.data.insights.length > 0);

  // user B cannot see, query, download or delete A's dataset
  assert.equal((await api('GET', `/api/datasets/${ds.id}`, { token: b })).status, 404);
  assert.equal((await api('POST', '/api/ai/query', { token: b, json: { dataset_id: ds.id, user_query: 'count' } })).status, 404);
  assert.equal((await api('POST', '/api/ai/insights', { token: b, json: { dataset_id: ds.id } })).status, 404);
  assert.equal((await api('GET', `/api/download/${ds.id}`, { token: b })).status, 404);
  assert.equal((await api('DELETE', `/api/datasets/${ds.id}`, { token: b })).status, 404);
  // client-supplied table_name / user_id are ignored
  const sneaky = await api('POST', '/api/ai/query', { token: b, json: { table_name: 'ds_' + 'a'.repeat(32), user_id: 'x', user_query: 'count' } });
  assert.equal(sneaky.status, 400);

  const dl = await api('GET', `/api/download/${ds.id}`, { token: a });
  assert.equal(dl.status, 200);
  assert.equal(dl.data, CSV);

  assert.equal((await api('DELETE', `/api/datasets/${ds.id}`, { token: a })).status, 200);
  assert.equal((await api('POST', '/api/ai/query', { token: a, json: { dataset_id: ds.id, user_query: 'count' } })).status, 404);
  assert.equal((await api('GET', `/api/download/${ds.id}`, { token: a })).status, 404);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'uploads', `${ds.id}.csv`)), false);
});

test('upload validation', { skip }, async () => {
  const t = (await register('up@example.com')).data.data.token;
  assert.equal((await api('POST', '/api/upload', { token: t })).status, 400);
  assert.equal((await api('POST', '/api/upload', { token: t, form: csvForm('a,b\n1,2\n', 'x.txt') })).status, 400);
  assert.equal((await api('POST', '/api/upload', { token: t, form: csvForm('', 'empty.csv') })).status, 400);
  assert.equal((await api('POST', '/api/upload', { token: t, form: csvForm('a,b\n', 'headers-only.csv') })).status, 400);
  const big = csvForm('a\n' + '1\n'.repeat(6 * 1024 * 1024), 'big.csv');
  assert.equal((await api('POST', '/api/upload', { token: t, form: big })).status, 413);
  assert.equal((await api('GET', '/api/datasets', { token: t })).data.data.length, 0, 'failed uploads leave no records');
});

test('query validation and AI-service credential problems', { skip }, async () => {
  const t = (await register('qv@example.com')).data.data.token;
  assert.equal((await api('POST', '/api/ai/query', { token: t, json: { dataset_id: 'nope', user_query: 'x' } })).status, 400);
  assert.equal((await api('POST', '/api/ai/query', { token: t, json: { dataset_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } })).status, 400);
  assert.equal((await api('POST', '/api/ai/query', { token: t, json: { dataset_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', user_query: 'x' } })).status, 404);
  // the AI service itself refuses callers without the shared secret
  const direct = await fetch(`http://127.0.0.1:${AI_PORT}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_query: 'x', table_name: 'ds_' + 'a'.repeat(32) }) });
  assert.equal(direct.status, 401);
});
