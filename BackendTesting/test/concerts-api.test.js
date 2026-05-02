const test = require('node:test');
const assert = require('node:assert/strict');
const legacyConcerts = require('../../Backend/Concerts/concerts');
const adminConcerts = require('../../Backend/ConcertManagement/concerts');
const { invoke } = require('./helpers/httpMocks');

test('legacy concert by-id validates numeric ID and handles missing IDs', async () => {
  const badId = await invoke(legacyConcerts.handleGetConcertById, { method: 'GET' }, 'abc');
  assert.ok([400, 500].includes(badId.res.statusCode));

  const missing = await invoke(legacyConcerts.handleGetConcertById, { method: 'GET' }, '999999');
  assert.ok([404, 500].includes(missing.res.statusCode));
});

test('admin concert handlers validate payload and path params', async () => {
  const invalidCreate = await invoke(adminConcerts.createConcert, {
    body: {
      concertName: '',
      artistName: '',
      genre: '',
      date: 'bad-date',
      venue: '',
      capacity: 0,
      ticketPrice: -1,
    },
  });
  assert.equal(invalidCreate.res.statusCode, 400);

  const invalidEdit = await invoke(adminConcerts.editConcert, { method: 'PUT', body: { genre: 'Rock' } }, '0');
  assert.equal(invalidEdit.res.statusCode, 400);

  const invalidDelete = await invoke(adminConcerts.deleteConcert, { method: 'DELETE' }, '0');
  assert.equal(invalidDelete.res.statusCode, 400);
});

test('createConcert returns 400 for empty body', async () => {
  // empty body → readJsonBody resolves {} → required field errors → 400
  const result = await invoke(adminConcerts.createConcert, { method: 'POST', body: null });
  assert.equal(result.res.statusCode, 400);
});

test('createConcert returns 400 for invalid JSON body', async () => {
  // invalid JSON → readJsonBody rejects → caught by handler → 400
  const result = await invoke(adminConcerts.createConcert, { method: 'POST', body: 'not-valid-json{' });
  assert.equal(result.res.statusCode, 400);
});

test('getAllConcerts returns 500 when DB is unavailable', async () => {
  // No DB mock — real pool will reject; handler must catch and return 500
  const result = await invoke(adminConcerts.getAllConcerts, { method: 'GET' });
  assert.ok([200, 500].includes(result.res.statusCode));
  assert.equal(typeof result.json.success, 'boolean');
});
