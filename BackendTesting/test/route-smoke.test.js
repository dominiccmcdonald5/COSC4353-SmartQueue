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
