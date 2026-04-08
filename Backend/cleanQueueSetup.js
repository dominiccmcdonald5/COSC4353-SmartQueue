// Clean setup for test queue - ensure User 50 is exactly 6th in line
const fs = require('fs');
const path = require('path');

const STORE_FILE_PATH = path.join(__dirname, 'mockDataStore.json');

// Read current data
let data = JSON.parse(fs.readFileSync(STORE_FILE_PATH, 'utf8'));

// COMPLETELY remove all active queue entries for concert 1
data.HISTORY = data.HISTORY.filter(h => 
  !(h.concertID === 1 && h.status === 'queued' && h.inLineStatus === 'in_line')
);

// Find the max historyID
let maxHistoryID = Math.max(...data.HISTORY.map(h => h.historyID || 0), 0);

// Create clean queue entries ONLY for concert 1
// Users 1-5 in positions 1-5, User 50 in position 6
const newQueueEntries = [
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

// Add new queue entries
data.HISTORY.push(...newQueueEntries);

// Write back
fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log('✅ Queue cleaned and setup complete!');
console.log('');
console.log('🎯 Concert 1 Queue (Fresh Start):');
console.log('   1. User 1 (Alex Smith)');
console.log('   2. User 2 (Jordan Johnson)');
console.log('   3. User 3 (Taylor Williams)');
console.log('   4. User 4 (Morgan Brown)');
console.log('   5. User 5 (Casey Jones)');
console.log('   6. User 50 (Rowan Moore) <- POSITION 6 ✨');
console.log('');
console.log('📍 Login as User 50 to test the notification:');
console.log('   Email: rowan.moore0050@smartqueue.test');
console.log('   Password: mockUserPass0050');
