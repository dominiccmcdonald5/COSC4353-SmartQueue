const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('../../Backend/database');
const report  = require('../../Backend/AdminDataReport/dataReportStats');
const { invoke } = require('./helpers/httpMocks');

const MOCK_USERS = [
  { userID: 1, firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com', passStatus: 'Gold', createdAt: new Date('2026-01-01T00:00:00.000Z') },
  { userID: 2, firstName: 'Bob',   lastName: 'Jones', email: 'bob@test.com',   passStatus: 'None', createdAt: new Date('2026-02-01T00:00:00.000Z') },
];

const MOCK_CONCERTS = [
  { concertID: 1, concertName: 'Test Concert', artistName: 'Test Artist', genre: 'Pop',  date: '2026-06-01', venue: 'Test Arena' },
  { concertID: 2, concertName: 'Rock Night',   artistName: 'Rock Band',   genre: 'Rock', date: '2026-07-01', venue: 'Main Stage' },
];

const MOCK_HISTORY = [
  { historyID: 1, userID: 1, concertID: 1, ticketCount: 2, totalCost: 100, waitTime: 30, status: 'completed', inLineStatus: 'entered', queuedAt: new Date('2026-03-15T10:00:00.000Z') },
  { historyID: 2, userID: 2, concertID: 1, ticketCount: 1, totalCost: 50,  waitTime: 20, status: 'queued',    inLineStatus: null,      queuedAt: new Date('2026-03-20T14:00:00.000Z') },
  { historyID: 3, userID: 1, concertID: 2, ticketCount: 3, totalCost: 0,   waitTime: 10, status: 'cancelled', inLineStatus: null,      queuedAt: new Date('2026-04-01T09:00:00.000Z') },
];

function withMockedDb(fn) {
  const original = database.promisePool.query;
  database.promisePool.query = async (sql) => {
    if (sql.includes('FROM users'))         return [MOCK_USERS];
    if (sql.includes('FROM concerts'))      return [MOCK_CONCERTS];
    if (sql.includes('FROM queue_history')) return [MOCK_HISTORY];
    return [[]];
  };
  return Promise.resolve().then(fn).finally(() => {
    database.promisePool.query = original;
  });
}

test('getDataReportStats returns report payload', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.getDataReportStats, { method: 'GET' });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.json.success, true);
    assert.equal(result.json.data.totalUsers, 2);
    assert.equal(result.json.data.totalEvents, 2);
    assert.ok(Array.isArray(result.json.data.topGenres));
    assert.ok(typeof result.json.data.reportGeneratedAt === 'string');
  });
});

test('getDataReportStats includes revenue and distributions', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.getDataReportStats, { method: 'GET' });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.json.data.totalRevenue, 100);
    assert.ok(Array.isArray(result.json.data.passDistribution));
    assert.ok(Array.isArray(result.json.data.monthlyRevenueTrend));
    assert.ok(Array.isArray(result.json.data.userGrowth));
  });
});

test('getDataReportDetails returns detailed report payload', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.getDataReportDetails, { method: 'GET' });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.json.success, true);
    assert.ok(Array.isArray(result.json.data.usersQueueHistory));
    assert.ok(Array.isArray(result.json.data.serviceQueueActivity));
    assert.ok(Array.isArray(result.json.data.allQueueHistory));
    assert.ok(typeof result.json.data.queueUsageStatistics === 'object');
    assert.ok(typeof result.json.data.reportGeneratedAt === 'string');
  });
});

test('getDataReportDetails service activity aggregates correctly', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.getDataReportDetails, { method: 'GET' });
    assert.equal(result.res.statusCode, 200);
    const svc = result.json.data.serviceQueueActivity;
    assert.equal(svc.length, 2);
    const s1 = svc.find((s) => s.serviceID === 1);
    assert.equal(s1.totalQueueEntries, 2);
    assert.equal(s1.usersServed, 1);
    assert.equal(s1.revenueFromCompleted, 100);
    assert.equal(s1.activeQueueEntries, 1);
  });
});

test('getDataReportDetails queueUsageStatistics totals are correct', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.getDataReportDetails, { method: 'GET' });
    const qs = result.json.data.queueUsageStatistics;
    assert.equal(qs.totalQueueEntries, 3);
    assert.equal(qs.usersServed, 1);
    assert.equal(qs.activeQueueEntries, 1);
    assert.equal(qs.cancelledEntries, 1);
    assert.equal(qs.totalRevenueFromCompleted, 100);
  });
});

test('exportDataReportCsv returns users csv content', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.exportDataReportCsv, {
      method: 'GET',
      url: '/api/admin/data-report/export.csv?report=users',
    });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.match(result.res.body, /User ID,Customer Name,Email/);
  });
});

test('exportDataReportCsv returns services csv content', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.exportDataReportCsv, {
      method: 'GET',
      url: '/api/admin/data-report/export.csv?report=services',
    });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.match(result.res.body, /Service ID,Service Name,Artist Name/);
    assert.match(result.res.body, /Test Concert/);
  });
});

test('exportDataReportCsv returns queue usage csv content', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.exportDataReportCsv, {
      method: 'GET',
      url: '/api/admin/data-report/export.csv?report=queue-usage',
    });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.match(result.res.body, /History ID,User ID,Customer Name,Email,Concert ID/);
  });
});

test('exportDataReportCsv rejects invalid report type', async () => {
  await withMockedDb(async () => {
    const result = await invoke(report.exportDataReportCsv, {
      method: 'GET',
      url: '/api/admin/data-report/export.csv?report=bad-type',
    });
    assert.equal(result.res.statusCode, 400);
    assert.equal(result.json.success, false);
  });
});
