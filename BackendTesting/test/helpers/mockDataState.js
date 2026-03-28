const mockData = require('../../../Backend/mockData');

const initial = JSON.parse(JSON.stringify(mockData.allMockData));

function resetMockData() {
  const fresh = JSON.parse(JSON.stringify(initial));
  Object.keys(mockData.allMockData).forEach((k) => {
    delete mockData.allMockData[k];
  });
  Object.assign(mockData.allMockData, fresh);
  mockData.persistMockData(mockData.allMockData);
}

module.exports = { resetMockData, mockData };
