require('dotenv').config();

const mysql = require('mysql2');

function toBool(value, defaultValue) {
  if (value == null) return defaultValue;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return defaultValue;
}

const sslEnabled = toBool(process.env.DB_SSL, true);
const sslRejectUnauthorized = toBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: sslEnabled
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
      }
    : undefined,
});

module.exports = {
  pool,
  promisePool: pool.promise(),
};
