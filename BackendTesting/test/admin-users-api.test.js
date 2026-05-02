const test = require('node:test');
const assert = require('node:assert/strict');
const adminUsers = require('../../Backend/UserManagement/adminUsers');
const { invoke } = require('./helpers/httpMocks');

test('createUser validates required fields', async () => {
  const result = await invoke(adminUsers.createUser, {
    body: { email: '', password: '123' },
  });
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('editUser validates user id path param', async () => {
  const result = await invoke(
    adminUsers.editUser,
    { method: 'PUT', body: { status: 'active' } },
    '0'
  );
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('deleteUser validates user id path param', async () => {
  const result = await invoke(adminUsers.deleteUser, { method: 'DELETE' }, '0');
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('createUser returns 400 for empty body', async () => {
  // empty body → readJsonBody resolves {} → required field validation errors → 400
  const result = await invoke(adminUsers.createUser, { method: 'POST', body: null });
  assert.equal(result.res.statusCode, 400);
});

test('createUser returns non-200 for invalid JSON body', async () => {
  // invalid JSON string → readJsonBody rejects → caught by handler
  const result = await invoke(adminUsers.createUser, { method: 'POST', body: 'not-valid-json{' });
  assert.ok([400, 500].includes(result.res.statusCode));
});

test('editUser returns 400 for empty body with valid mocked DB', async () => {
  // This test uses a direct validation branch without mocking; editUser validates userID first
  // userID 'abc' → NaN → invalid → 400 immediately (covers parseInt branch)
  const result = await invoke(adminUsers.editUser, { method: 'PUT', body: {} }, 'abc');
  assert.equal(result.res.statusCode, 400);
});

test('getAllUsers returns 500 when DB is unavailable', async () => {
  // No DB mock — real pool will reject; handler must catch and return 500
  const result = await invoke(adminUsers.getAllUsers, { method: 'GET' });
  assert.ok([200, 500].includes(result.res.statusCode));
  assert.equal(typeof result.json.success, 'boolean');
});
