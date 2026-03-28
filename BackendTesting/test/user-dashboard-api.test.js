const test = require('node:test');
const assert = require('node:assert/strict');
const userHistory = require('../../Backend/UserDashboard/ConcertHistory/userHistory');
const userStats = require('../../Backend/UserDashboard/UserStats/userStats');
const { invoke } = require('./helpers/httpMocks');
const { resetMockData, mockData } = require('./helpers/mockDataState');

test.beforeEach(() => resetMockData());

test('getConcertHistory returns user concert records', async () => {
  const userID = mockData.allMockData.USER[0].userID;
  const result = await invoke(userHistory.getConcertHistory, { body: { userID } });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.json.success, true);
  assert.equal(result.json.userID, userID);
  assert.ok(Array.isArray(result.json.concerts));
});

test('getConcertHistory rejects invalid user id', async () => {
  const result = await invoke(userHistory.getConcertHistory, { body: { userID: 0 } });
  assert.equal(result.res.statusCode, 400);
});

test('getUserStats returns computed stats', async () => {
  const userID = mockData.allMockData.USER[0].userID;
  const result = await invoke(userStats.getUserStats, { body: { userID } });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.json.success, true);
  assert.equal(typeof result.json.totalQueues, 'number');
  assert.equal(typeof result.json.totalSpending, 'number');
});
