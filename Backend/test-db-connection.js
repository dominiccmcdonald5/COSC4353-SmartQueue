/**
 * Quick check that .env DB settings work (from main branch script).
 */
require('dotenv').config();
const { promisePool } = require('./database');

async function main() {
  try {
    const [rows] = await promisePool.query('SELECT 1 AS ok');
    const ok = Array.isArray(rows) && rows[0] && rows[0].ok === 1;
    if (!ok) {
      console.error('Unexpected result:', rows);
      process.exit(1);
    }
    console.log('Database connection OK');
    process.exit(0);
  } catch (e) {
    console.error('Database connection failed:', e.message || e);
    process.exit(1);
  }
}

main();
