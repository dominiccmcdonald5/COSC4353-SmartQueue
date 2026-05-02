const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../Backend/route');
const { createReq, createRes } = require('./helpers/httpMocks');

test('route returns 404 for unknown path', async () => {
  const req = createReq({ method: 'GET', url: '/api/does-not-exist' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.equal(res.statusCode, 404);
});

test('route handles ping endpoint', async () => {
  const req = createReq({ method: 'GET', url: '/api/ping' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
});

test('route dispatches GET /api/admin/data-report to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/admin/data-report' });
  const res = createRes();
  routes(req, res);
  await res.done;
  // Without a real DB the handler returns 500; the route must NOT return 404
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/admin/concerts to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/admin/concerts' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/admin/users to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/admin/users' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/login to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/login', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/signup to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/signup', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/user/history to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/user/history', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/user/stats to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/user/stats', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/user/pass/update to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/user/pass/update', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/admin/data-report/details to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/admin/data-report/details' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/admin/data-report/export.csv to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/admin/data-report/export.csv' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/concerts to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/concerts' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/concerts/:id to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/concerts/1' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/admin/concerts to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/admin/concerts', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches PUT /api/admin/concerts/:id to handler', async () => {
  const req = createReq({ method: 'PUT', url: '/api/admin/concerts/1', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches DELETE /api/admin/concerts/:id to handler', async () => {
  const req = createReq({ method: 'DELETE', url: '/api/admin/concerts/1' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/admin/users to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/admin/users', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches PUT /api/admin/users/:id to handler', async () => {
  const req = createReq({ method: 'PUT', url: '/api/admin/users/1', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches DELETE /api/admin/users/:id to handler', async () => {
  const req = createReq({ method: 'DELETE', url: '/api/admin/users/1' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/admin/queue to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/admin/queue' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/admin/queue/serve-next to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/admin/queue/serve-next', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/queue/join to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/queue/join', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/queue/leave to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/queue/leave', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/payment/complete to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/payment/complete', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches GET /api/queue/:id to handler', async () => {
  const req = createReq({ method: 'GET', url: '/api/queue/1?userId=1' });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/notifications to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/notifications', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});

test('route dispatches POST /api/notifications/mark-viewed to handler', async () => {
  const req = createReq({ method: 'POST', url: '/api/notifications/mark-viewed', body: {} });
  const res = createRes();
  routes(req, res);
  await res.done;
  assert.notEqual(res.statusCode, 404);
});
