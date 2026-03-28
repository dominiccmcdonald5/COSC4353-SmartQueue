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
