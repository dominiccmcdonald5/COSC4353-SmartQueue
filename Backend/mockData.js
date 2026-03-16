const fs = require('fs');
const path = require('path');

const STORE_FILE_PATH = path.join(__dirname, 'mockDataStore.json');

function createDefaultMockData() {
  return {
    USER: Array.from({ length: 300 }, (_, index) => {
      const id = index + 1;
      const firstName = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Parker', 'Quinn', 'Rowan'][index % 10];
      const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Wilson', 'Moore'][index % 10];
      return {
        userID: id,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${String(id).padStart(4, '0')}@smartqueue.test`,
        password: `mockUserPass${String(id).padStart(4, '0')}`,
        passStatus: id % 5 === 0 ? 'active' : 'inactive',
        createdAt: new Date(2025, index % 12, (index % 28) + 1, 8, index % 60, 0, 0).toISOString(),
      };
    }),
    CONCERT: Array.from({ length: 180 }, (_, index) => {
      const id = index + 1;
      return {
        concertID: id,
        concertName: `SmartQueue Live Event ${String(id).padStart(3, '0')}`,
        artistName: ['Neon Pulse', 'Skyline Echo', 'Midnight Frequency', 'Luna Drift', 'Solar Avenue', 'Velvet Riot'][index % 6],
        genre: ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Country', 'EDM', 'Indie', 'Jazz'][index % 8],
        date: new Date(2026, index % 12, ((index * 2) % 28) + 1, 19, 30, 0, 0).toISOString(),
        venue: ['Toyota Center', 'NRG Stadium', 'Minute Maid Park', 'Downtown Arena', 'Bayfront Pavilion', 'Riverwalk Stage'][index % 6],
        capacity: 1000 + (id * 35),
        ticketPrice: Number((35 + ((id % 20) * 6.25)).toFixed(2)),
        concertImage: `https://picsum.photos/seed/smartqueue-concert-${id}/600/400`,
        concertStatus: id % 11 === 0 ? 'sold_out' : 'open',
      };
    }),
    HISTORY: Array.from({ length: 2400 }, (_, index) => {
      const id = index + 1;
      const userID = (index % 300) + 1;
      const concertID = (index % 180) + 1;
      const ticketCount = (index % 4) + 1;
      const ticketPrice = Number((35 + (((concertID % 20) + 1) * 6.25)).toFixed(2));
      return {
        historyID: id,
        userID,
        concertID,
        ticketCount,
        totalCost: Number((ticketCount * ticketPrice).toFixed(2)),
        waitTime: 30 + ((id * 17) % 3600),
        status: ['queued', 'completed', 'cancelled'][index % 3],
        inLineStatus: ['in_line', 'entered', 'left'][index % 3],
        queuedAt: new Date(2026, index % 12, ((index * 3) % 28) + 1, 9 + (index % 10), index % 60, 0, 0).toISOString(),
      };
    }),
    ADMIN: Array.from({ length: 25 }, (_, index) => {
      const id = index + 1;
      return {
        user: `admin${String(id).padStart(2, '0')}`,
        password: `adminPass${String(id).padStart(3, '0')}`,
      };
    }),
  };
}

function hasValidShape(value) {
  return (
    value
    && Array.isArray(value.USER)
    && Array.isArray(value.CONCERT)
    && Array.isArray(value.HISTORY)
    && Array.isArray(value.ADMIN)
  );
}

function persistMockData(allMockData) {
  fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(allMockData, null, 2), 'utf8');
}

function loadMockData() {
  if (!fs.existsSync(STORE_FILE_PATH)) {
    const defaults = createDefaultMockData();
    persistMockData(defaults);
    return defaults;
  }

  try {
    const raw = fs.readFileSync(STORE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (hasValidShape(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load mockDataStore.json, regenerating defaults.', error);
  }

  const defaults = createDefaultMockData();
  persistMockData(defaults);
  return defaults;
}

const allMockData = loadMockData();

const mockTables = [
  {
    table: 'USER',
    attributes: ['userID', 'firstName', 'lastName', 'email', 'password', 'passStatus', 'createdAt'],
    rows: allMockData.USER,
  },
  {
    table: 'CONCERT',
    attributes: ['concertID', 'concertName', 'artistName', 'genre', 'date', 'venue', 'capacity', 'ticketPrice', 'concertImage', 'concertStatus'],
    rows: allMockData.CONCERT,
  },
  {
    table: 'HISTORY',
    attributes: ['historyID', 'userID', 'concertID', 'ticketCount', 'totalCost', 'waitTime', 'status', 'inLineStatus', 'queuedAt'],
    rows: allMockData.HISTORY,
  },
  {
    table: 'ADMIN',
    attributes: ['user', 'password'],
    rows: allMockData.ADMIN,
  },
];

module.exports = {
  mockTables,
  allMockData,
  persistMockData,
  STORE_FILE_PATH,
};
