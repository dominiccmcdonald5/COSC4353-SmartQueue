const test = require('node:test');
const assert = require('node:assert/strict');
const login = require('../../Backend/Login/login');
const signup = require('../../Backend/SignUp/signup');
const pass = require('../../Backend/PassPurchase/updatePass');
const { invoke } = require('./helpers/httpMocks');

test('signup rejects missing required fields', async () => {
  const result = await invoke(signup.handleSignup, {
    body: { firstName: 'Unit', email: 'unit@test.com' },
  });
  assert.equal(result.res.statusCode, 500);
  assert.equal(result.json.success, false);
});

test('login rejects missing required fields', async () => {
  const result = await invoke(login.handleLogin, { body: { email: '' } });
  assert.equal(result.res.statusCode, 500);
  assert.equal(result.json.success, false);
});

test('updateUserPassStatus validates user and pass tier input', async () => {
  const badUser = await invoke(pass.updateUserPassStatus, {
    body: { userID: 0, passStatus: 'Gold' },
  });
  assert.equal(badUser.res.statusCode, 400);

  const badTier = await invoke(pass.updateUserPassStatus, {
    body: { userID: 1, passStatus: 'Platinum' },
  });
  assert.equal(badTier.res.statusCode, 400);
});
