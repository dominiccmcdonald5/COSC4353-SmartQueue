const test = require('node:test');
const assert = require('node:assert/strict');
const actions = require('../../Backend/simpleActions');
const { createReq, createRes, invoke } = require('./helpers/httpMocks');

test('handlePing returns healthy response', async () => {
  const req = createReq({ method: 'GET', url: '/api/ping' });
  const res = createRes();
  actions.handlePing(req, res);
  await res.done;

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.message, 'Backend is reachable');
});

test('mock data handlers return counts', async () => {
  const all = await invoke(actions.handleMockAll, { method: 'GET' });
  assert.equal(all.res.statusCode, 200);
  assert.ok(all.json.users.count >= 0);
  assert.ok(all.json.concerts.count >= 0);

  const users = await invoke(actions.handleMockUsers, { method: 'GET' });
  assert.equal(users.res.statusCode, 200);
  assert.equal(users.json.count, users.json.data.length);

  const admins = await invoke(actions.handleMockAdmins, { method: 'GET' });
  assert.equal(admins.res.statusCode, 200);

  const concerts = await invoke(actions.handleMockConcerts, { method: 'GET' });
  assert.equal(concerts.res.statusCode, 200);

  const history = await invoke(actions.handleMockHistory, { method: 'GET' });
  assert.equal(history.res.statusCode, 200);
});
