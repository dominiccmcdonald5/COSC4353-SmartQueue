const test = require('node:test');
const assert = require('node:assert/strict');
const queue = require('../../Backend/AdminQueue/queue');
const { invoke } = require('./helpers/httpMocks');

test('joinQueue validates required IDs', async () => {
  const result = await invoke(queue.joinQueue, { body: { concertId: 0, userId: 0 } });
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('leaveQueue validates required IDs', async () => {
  const result = await invoke(queue.leaveQueue, { body: { concertId: -1, userId: 'x' } });
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('completePayment validates ticketCount and totalCost', async () => {
  const badTicketCount = await invoke(queue.completePayment, {
    body: { concertId: 1, userId: 1, ticketCount: 0, totalCost: 10 },
  });
  assert.equal(badTicketCount.res.statusCode, 400);

  const badTotal = await invoke(queue.completePayment, {
    body: { concertId: 1, userId: 1, ticketCount: 1, totalCost: -10 },
  });
  assert.equal(badTotal.res.statusCode, 400);
});

test('getQueueStatusByConcert validates concert ID', async () => {
  const result = await invoke(queue.getQueueStatusByConcert, { method: 'GET' }, '0', '1');
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('notifications handlers validate payloads', async () => {
  const getResult = await invoke(queue.getNotifications, { body: { userId: 0 } });
  assert.equal(getResult.res.statusCode, 400);

  const markResult = await invoke(queue.markNotificationAsViewed, { body: { notificationId: 0 } });
  assert.equal(markResult.res.statusCode, 400);
});
