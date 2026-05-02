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

/** Each Node process keeps up to this many DB connections. Hosting that runs many instances (e.g. serverless) multiplies usage — keep small unless your DB allows high max_connections. */
function parseConnectionLimit() {
  const raw = process.env.DB_CONNECTION_LIMIT;
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 50);
  }
  return 5;
}

const connectionLimit = parseConnectionLimit();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: sslEnabled
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
      }
    : undefined,
});

const promisePool = pool.promise();

module.exports = {
  pool,
  promisePool,
};
