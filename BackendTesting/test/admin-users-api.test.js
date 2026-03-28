const test = require('node:test');
const assert = require('node:assert/strict');
const adminUsers = require('../../Backend/UserManagement/adminUsers');
const { invoke } = require('./helpers/httpMocks');
const { resetMockData } = require('./helpers/mockDataState');

test.beforeEach(() => resetMockData());

test('admin users CRUD handlers work', async () => {
  const list = await invoke(adminUsers.getAllUsers, { method: 'GET' });
  assert.equal(list.res.statusCode, 200);
  assert.equal(list.json.success, true);

  const created = await invoke(adminUsers.createUser, {
    body: {
      name: 'Unit AdminUser',
      email: 'adminuser.unit@test.com',
      password: 'pass1234',
      passType: 'silver',
      status: 'active',
      totalSpent: 10.5,
    },
  });
  assert.equal(created.res.statusCode, 201);
  const userID = Number(created.json.user.userID);

  const edited = await invoke(adminUsers.editUser, {
    method: 'PUT',
    body: { status: 'suspended', passType: 'gold' },
  }, String(userID));
  assert.equal(edited.res.statusCode, 200);
  assert.equal(edited.json.user.passType, 'gold');

  const deleted = await invoke(adminUsers.deleteUser, { method: 'DELETE' }, String(userID));
  assert.equal(deleted.res.statusCode, 200);
  assert.equal(deleted.json.success, true);
});
