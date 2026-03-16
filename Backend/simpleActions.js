const mockData = require('./mockData');

function handlePing(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      ok: true,
      message: 'Backend is reachable',
      timestamp: new Date().toISOString(),
    })
  );
}

function sendJson(res, payload) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleMockUsers(req, res) {
  sendJson(res, {
    count: mockData.allMockData.USER.length,
    data: mockData.allMockData.USER,
  });
}

function handleMockAdmins(req, res) {
  sendJson(res, {
    count: mockData.allMockData.ADMIN.length,
    data: mockData.allMockData.ADMIN,
  });
}

function handleMockConcerts(req, res) {
  sendJson(res, {
    count: mockData.allMockData.CONCERT.length,
    data: mockData.allMockData.CONCERT,
  });
}

function handleMockHistory(req, res) {
  sendJson(res, {
    count: mockData.allMockData.HISTORY.length,
    data: mockData.allMockData.HISTORY,
  });
}

function handleMockAll(req, res) {
  sendJson(res, {
    users: {
      count: mockData.allMockData.USER.length,
      data: mockData.allMockData.USER,
    },
    admins: {
      count: mockData.allMockData.ADMIN.length,
      data: mockData.allMockData.ADMIN,
    },
    concerts: {
      count: mockData.allMockData.CONCERT.length,
      data: mockData.allMockData.CONCERT,
    },
    history: {
      count: mockData.allMockData.HISTORY.length,
      data: mockData.allMockData.HISTORY,
    },
    mockTables: mockData.mockTables,
    allMockData: mockData.allMockData,
  });
}

module.exports = {
  handlePing,
  handleMockUsers,
  handleMockAdmins,
  handleMockConcerts,
  handleMockHistory,
  handleMockAll,
};
