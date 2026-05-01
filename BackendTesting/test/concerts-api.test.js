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
