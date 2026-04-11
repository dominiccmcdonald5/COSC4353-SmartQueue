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
