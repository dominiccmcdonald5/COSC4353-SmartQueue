const test = require('node:test');
const assert = require('node:assert/strict');
const login = require('../../Backend/Login/login');
const signup = require('../../Backend/SignUp/signup');
const pass = require('../../Backend/PassPurchase/updatePass');
const { invoke } = require('./helpers/httpMocks');
const { resetMockData, mockData } = require('./helpers/mockDataState');

test.beforeEach(() => resetMockData());

test('signup creates a user and login succeeds', async () => {
  const email = 'unit.signup@test.com';
  const password = 'pass1234';

  const created = await invoke(signup.handleSignup, {
    body: { firstName: 'Unit', lastName: 'Tester', email, password },
  });
  assert.equal(created.res.statusCode, 201);
  assert.equal(created.json.success, true);

  const loggedIn = await invoke(login.handleLogin, { body: { email, password } });
  assert.equal(loggedIn.res.statusCode, 200);
  assert.equal(loggedIn.json.success, true);
  assert.equal(loggedIn.json.accountType, 'user');
});

test('login with bad credentials returns not found', async () => {
  const result = await invoke(login.handleLogin, {
    body: { email: 'nobody@example.com', password: 'wrong' },
  });
  assert.equal(result.res.statusCode, 404);
  assert.equal(result.json.success, false);
});

test('updateUserPassStatus validates and updates user pass tier', async () => {
  const userID = mockData.allMockData.USER[0].userID;

  const invalid = await invoke(pass.updateUserPassStatus, {
    body: { userID, passStatus: 'Platinum' },
  });
  assert.equal(invalid.res.statusCode, 400);

  const updated = await invoke(pass.updateUserPassStatus, {
    body: { userID, passStatus: 'gold' },
  });
  assert.equal(updated.res.statusCode, 200);
  assert.equal(updated.json.passStatus, 'Gold');
});
