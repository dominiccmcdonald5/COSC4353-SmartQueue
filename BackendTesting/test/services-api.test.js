const test = require('node:test');
const assert = require('node:assert/strict');
const services = require('../../Backend/ServiceManagement/services');
const { invoke } = require('./helpers/httpMocks');

test('listServices returns current service list', async () => {
  const result = await invoke(services.listServices, { method: 'GET' });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.json.success, true);
  assert.ok(Array.isArray(result.json.services));
});

test('createService validates payload and can create', async () => {
  const bad = await invoke(services.createService, { body: { serviceName: '' } });
  assert.equal(bad.res.statusCode, 400);

  const good = await invoke(services.createService, {
    body: {
      serviceName: 'Unit Test Service',
      description: 'Detailed description for unit test service',
      expectedDuration: 25,
      priorityLevel: 'high',
    },
  });
  assert.equal(good.res.statusCode, 201);
  assert.equal(good.json.success, true);
});

test('updateService updates existing service', async () => {
  const list = await invoke(services.listServices, { method: 'GET' });
  const serviceID = list.json.services[0].serviceID;

  const updated = await invoke(services.updateService, {
    method: 'PUT',
    body: { expectedDuration: 99 },
  }, serviceID);

  assert.equal(updated.res.statusCode, 200);
  assert.equal(updated.json.service.expectedDuration, 99);
});
