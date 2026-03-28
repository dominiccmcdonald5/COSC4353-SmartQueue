const test = require('node:test');
const assert = require('node:assert/strict');
const legacyConcerts = require('../../Backend/Concerts/concerts');
const adminConcerts = require('../../Backend/ConcertManagement/concerts');
const { invoke } = require('./helpers/httpMocks');
const { resetMockData, mockData } = require('./helpers/mockDataState');

test.beforeEach(() => resetMockData());

test('legacy concerts list and by-id handlers respond', async () => {
  const list = await invoke(legacyConcerts.handleGetConcerts, { method: 'GET' });
  assert.equal(list.res.statusCode, 200);
  assert.equal(list.json.success, true);

  const goodId = String(mockData.allMockData.CONCERT[0].concertID);
  const byId = await invoke(legacyConcerts.handleGetConcertById, { method: 'GET' }, goodId);
  assert.equal(byId.res.statusCode, 200);
  assert.equal(byId.json.success, true);

  const missing = await invoke(legacyConcerts.handleGetConcertById, { method: 'GET' }, '999999');
  assert.equal(missing.res.statusCode, 404);
});

test('admin concert CRUD handlers work', async () => {
  const initial = await invoke(adminConcerts.getAllConcerts, { method: 'GET' });
  assert.equal(initial.res.statusCode, 200);

  const created = await invoke(adminConcerts.createConcert, {
    body: {
      concertName: 'Unit Concert',
      artistName: 'Unit Artist',
      genre: 'Pop',
      date: '2026-10-10',
      venue: 'Unit Arena',
      capacity: 1000,
      ticketPrice: 55.5,
      concertImage: 'https://example.com/unit.jpg',
    },
  });
  assert.equal(created.res.statusCode, 201);
  const concertID = created.json.concert.concertID;

  const edited = await invoke(adminConcerts.editConcert, { method: 'PUT', body: { genre: 'Rock' } }, String(concertID));
  assert.equal(edited.res.statusCode, 200);
  assert.equal(edited.json.concert.genre, 'Rock');

  const deleted = await invoke(adminConcerts.deleteConcert, { method: 'DELETE' }, String(concertID));
  assert.equal(deleted.res.statusCode, 200);
  assert.equal(deleted.json.success, true);
});
