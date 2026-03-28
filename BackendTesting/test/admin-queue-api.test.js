const test = require('node:test');
const assert = require('node:assert/strict');
const queue = require('../../Backend/AdminQueue/queue');
const { invoke } = require('./helpers/httpMocks');
const { resetMockData, mockData } = require('./helpers/mockDataState');

test.beforeEach(() => resetMockData());

function addTempUser() {
  const nextId = mockData.allMockData.USER.reduce((m, u) => Math.max(m, u.userID), 0) + 1;
  mockData.allMockData.USER.push({
    userID: nextId,
    firstName: 'Queue',
    lastName: 'Tester',
    email: `queue.${nextId}@test.com`,
    password: 'pass1234',
    passStatus: 'None',
    createdAt: new Date().toISOString(),
  });
  return nextId;
}

test('admin queue list and serve-next respond', async () => {
  const list = await invoke(queue.getQueue, { method: 'GET' });
  assert.equal(list.res.statusCode, 200);
  assert.equal(list.json.success, true);

  const served = await invoke(queue.serveNext, { method: 'POST' });
  assert.equal(served.res.statusCode, 200);
  assert.equal(served.json.success, true);
});

test('queue status by concert and join/leave/payment lifecycle', async () => {
  const concertId = mockData.allMockData.CONCERT[0].concertID;
  const userId = addTempUser();

  const status = await invoke(queue.getQueueStatusByConcert, { method: 'GET' }, String(concertId), String(userId));
  assert.equal(status.res.statusCode, 200);
  assert.equal(status.json.success, true);

  const joined = await invoke(queue.joinQueue, { body: { concertId, userId } });
  assert.equal(joined.res.statusCode, 201);

  const paid = await invoke(queue.completePayment, {
    body: { concertId, userId, ticketCount: 2, totalCost: 150.75 },
  });
  assert.equal(paid.res.statusCode, 200);
  assert.equal(paid.json.history.status, 'completed');

  const joinedAgain = await invoke(queue.joinQueue, { body: { concertId, userId } });
  assert.equal(joinedAgain.res.statusCode, 201);

  const left = await invoke(queue.leaveQueue, { body: { concertId, userId } });
  assert.equal(left.res.statusCode, 200);
  assert.equal(left.json.entry.inLineStatus, 'left');
});

test('joinQueue blocks joining another concert when active', async () => {
  const concerts = mockData.allMockData.CONCERT.slice(0, 2);
  const userId = addTempUser();

  const firstJoin = await invoke(queue.joinQueue, { body: { concertId: concerts[0].concertID, userId } });
  assert.equal(firstJoin.res.statusCode, 201);

  const secondJoin = await invoke(queue.joinQueue, { body: { concertId: concerts[1].concertID, userId } });
  assert.equal(secondJoin.res.statusCode, 409);
  assert.equal(secondJoin.json.success, false);
});
