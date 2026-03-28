// Setup test queue data - User 50 will be 6th in line for Concert 1
const fs = require('fs');
const path = require('path');

const STORE_FILE_PATH = path.join(__dirname, 'mockDataStore.json');

// Read current data
let data = JSON.parse(fs.readFileSync(STORE_FILE_PATH, 'utf8'));

// Find the max historyID
let maxHistoryID = Math.max(...data.HISTORY.map(h => h.historyID), 0);

// Create queue entries for Concert 1
// Users 1-5 in line, with User 50 as 6th
const queueEntries = [
  {
    historyID: maxHistoryID + 1,
    userID: 1,
    concertID: 1,
    ticketCount: 1,
    totalCost: 47.5,
    waitTime: 0,
    status: 'queued',
    inLineStatus: 'in_line',
    queuedAt: '2026-03-27T10:00:00.000Z'
  },
  {
    historyID: maxHistoryID + 2,
    userID: 2,
    concertID: 1,
    ticketCount: 1,
    totalCost: 47.5,
    waitTime: 0,
    status: 'queued',
    inLineStatus: 'in_line',
    queuedAt: '2026-03-27T10:01:00.000Z'
  },
  {
    historyID: maxHistoryID + 3,
    userID: 3,
    concertID: 1,
    ticketCount: 1,
    totalCost: 47.5,
    waitTime: 0,
    status: 'queued',
    inLineStatus: 'in_line',
    queuedAt: '2026-03-27T10:02:00.000Z'
  },
  {
    historyID: maxHistoryID + 4,
    userID: 4,
    concertID: 1,
    ticketCount: 1,
    totalCost: 47.5,
    waitTime: 0,
    status: 'queued',
    inLineStatus: 'in_line',
    queuedAt: '2026-03-27T10:03:00.000Z'
  },
  {
    historyID: maxHistoryID + 5,
    userID: 5,
    concertID: 1,
    ticketCount: 1,
    totalCost: 47.5,
    waitTime: 0,
    status: 'queued',
    inLineStatus: 'in_line',
    queuedAt: '2026-03-27T10:04:00.000Z'
  },
  {
    historyID: maxHistoryID + 6,
    userID: 50,
    concertID: 1,
    ticketCount: 1,
    totalCost: 47.5,
    waitTime: 0,
    status: 'queued',
    inLineStatus: 'in_line',
    queuedAt: '2026-03-27T10:05:00.000Z'
  }
];

// Remove any existing queue entries for concert 1 with status queued/in_line
data.HISTORY = data.HISTORY.filter(h => 
  !(h.concertID === 1 && h.status === 'queued' && h.inLineStatus === 'in_line')
);

// Add new queue entries
data.HISTORY.push(...queueEntries);

// Write back
fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log('✅ Test queue setup complete!');
console.log('');
console.log('📍 Position 6 - User to Test: User 50');
console.log('   Email: rowan.moore0050@smartqueue.test');
console.log('   Password: mockUserPass0050');
console.log('   Concert: Concert 1 (SmartQueue Live Event 001)');
console.log('   Queue Position: 6');
console.log('');
console.log('Users in queue ahead:');
console.log('   1. User 1 (Alex Smith)');
console.log('   2. User 2 (Jordan Johnson) ');
console.log('   3. User 3 (Taylor Williams)');
console.log('   4. User 4 (Morgan Brown)');
console.log('   5. User 5 (Casey Jones)');
console.log('   6. User 50 (Rowan Moore) <- 6TH IN LINE ✨');
