const test = require('node:test');
const assert = require('node:assert/strict');
const report = require('../../Backend/AdminDataReport/dataReportStats');
const { invoke } = require('./helpers/httpMocks');

test('getDataReportStats returns report payload', async () => {
  const result = await invoke(report.getDataReportStats, { method: 'GET' });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.json.success, true);
  assert.ok(result.json.data.totalUsers >= 0);
  assert.ok(result.json.data.totalEvents >= 0);
  assert.ok(Array.isArray(result.json.data.topGenres));
});

test('getDataReportDetails returns detailed report payload', async () => {
  const result = await invoke(report.getDataReportDetails, { method: 'GET' });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.json.success, true);
  assert.ok(Array.isArray(result.json.data.usersQueueHistory));
  assert.ok(Array.isArray(result.json.data.serviceQueueActivity));
  assert.ok(Array.isArray(result.json.data.allQueueHistory));
  assert.ok(typeof result.json.data.queueUsageStatistics === 'object');
  assert.ok(typeof result.json.data.reportGeneratedAt === 'string');
});

test('exportDataReportCsv returns users csv content', async () => {
  const result = await invoke(report.exportDataReportCsv, {
    method: 'GET',
    url: '/api/admin/data-report/export.csv?report=users',
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.match(result.res.body, /User ID,Customer Name,Email/);
});

test('exportDataReportCsv returns full queue usage csv content', async () => {
  const result = await invoke(report.exportDataReportCsv, {
    method: 'GET',
    url: '/api/admin/data-report/export.csv?report=queue-usage',
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.match(result.res.body, /History ID,User ID,Customer Name,Email,Concert ID/);
});

test('exportDataReportCsv rejects invalid report type', async () => {
  const result = await invoke(report.exportDataReportCsv, {
    method: 'GET',
    url: '/api/admin/data-report/export.csv?report=bad-type',
  });
  assert.equal(result.res.statusCode, 400);
  assert.equal(result.json.success, false);
});
