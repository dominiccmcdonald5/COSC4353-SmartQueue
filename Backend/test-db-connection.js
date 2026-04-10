require('dotenv').config();

const pool = require('./database');

pool.query('SELECT 1 AS ok', (err, results) => {
  if (err) {
    console.error('DB connection test failed.');
    console.error(err.message);
    pool.end(() => process.exit(1));
    return;
  }

  const ok = Array.isArray(results) && results.length > 0 ? results[0].ok : null;
  console.log('DB connection test passed:', ok === 1 ? 'SELECT 1 returned 1' : results);
  pool.end(() => process.exit(0));
});
