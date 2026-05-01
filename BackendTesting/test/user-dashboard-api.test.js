const test = require('node:test');
const assert = require('node:assert/strict');
const userHistory = require('../../Backend/UserDashboard/ConcertHistory/userHistory');
const userStats = require('../../Backend/UserDashboard/UserStats/userStats');
const { invoke } = require('./helpers/httpMocks');

test('getConcertHistory rejects invalid user id', async () => {
  const result = await invoke(userHistory.getConcertHistory, { body: { userID: 0 } });
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});

test('getUserStats rejects invalid user id', async () => {
  const result = await invoke(userStats.getUserStats, { body: { userID: 0 } });
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});
