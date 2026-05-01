const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../Backend/route');
const { createReq, createRes, invoke } = require('./helpers/httpMocks');

const queue = require('../../Backend/AdminQueue/queue');
const adminUsers = require('../../Backend/UserManagement/adminUsers');
const adminConcerts = require('../../Backend/ConcertManagement/concerts');
const signup = require('../../Backend/SignUp/signup');
const login = require('../../Backend/Login/login');
const pass = require('../../Backend/PassPurchase/updatePass');
const userHistory = require('../../Backend/UserDashboard/ConcertHistory/userHistory');
const userStats = require('../../Backend/UserDashboard/UserStats/userStats');

test('route includes queue/payment/notification endpoints and does not 404', async () => {
  const checks = [
    { method: 'POST', url: '/api/queue/join', body: { concertId: 0, userId: 0 }, expected: 400 },
    { method: 'POST', url: '/api/queue/leave', body: { concertId: 0, userId: 0 }, expected: 400 },
    { method: 'POST', url: '/api/payment/complete', body: { concertId: 1, userId: 1, ticketCount: 0, totalCost: 10 }, expected: 400 },
    { method: 'GET', url: '/api/queue/0?userId=1', expected: 400 },
    { method: 'POST', url: '/api/notifications', body: { userId: 0 }, expected: 400 },
    { method: 'POST', url: '/api/notifications/mark-viewed', body: { notificationId: 0 }, expected: 400 },
  ];

  for (const c of checks) {
    const req = createReq({ method: c.method, url: c.url, body: c.body });
    const res = createRes();
    routes(req, res);
    await res.done;
    assert.equal(res.statusCode, c.expected);
  }
});

test('queue handlers input validation contracts remain stable', async () => {
  const join = await invoke(queue.joinQueue, { body: { concertId: 0, userId: 0 } });
  assert.equal(join.res.statusCode, 400);

  const leave = await invoke(queue.leaveQueue, { body: { concertId: 0, userId: 0 } });
  assert.equal(leave.res.statusCode, 400);

  const payment = await invoke(queue.completePayment, {
    body: { concertId: 1, userId: 1, ticketCount: 0, totalCost: 10 },
  });
  assert.equal(payment.res.statusCode, 400);
});

test('auth and pass handlers validate malformed payloads', async () => {
  const signupBad = await invoke(signup.handleSignup, { body: { email: 'a@b.com' } });
  assert.equal(signupBad.res.statusCode, 500);

  const loginBad = await invoke(login.handleLogin, { body: { email: '' } });
  assert.equal(loginBad.res.statusCode, 500);

  const passBad = await invoke(pass.updateUserPassStatus, {
    body: { userID: 1, passStatus: 'Platinum' },
  });
  assert.equal(passBad.res.statusCode, 400);
});

test('admin handlers validate path IDs and required payloads', async () => {
  const badCreateUser = await invoke(adminUsers.createUser, { body: { email: '', password: '123' } });
  assert.equal(badCreateUser.res.statusCode, 400);

  const badEditUser = await invoke(adminUsers.editUser, { method: 'PUT', body: { status: 'active' } }, '0');
  assert.equal(badEditUser.res.statusCode, 400);

  const badCreateConcert = await invoke(adminConcerts.createConcert, {
    body: { concertName: '', artistName: '', genre: '', date: 'bad', venue: '', capacity: 0, ticketPrice: -1 },
  });
  assert.equal(badCreateConcert.res.statusCode, 400);

  const badEditConcert = await invoke(adminConcerts.editConcert, { method: 'PUT', body: { genre: 'Rock' } }, '0');
  assert.equal(badEditConcert.res.statusCode, 400);
});

test('dashboard handlers validate user IDs before DB access', async () => {
  const badHistory = await invoke(userHistory.getConcertHistory, { body: { userID: 0 } });
  assert.equal(badHistory.res.statusCode, 400);

  const badStats = await invoke(userStats.getUserStats, { body: { userID: 0 } });
  assert.equal(badStats.res.statusCode, 400);
});
