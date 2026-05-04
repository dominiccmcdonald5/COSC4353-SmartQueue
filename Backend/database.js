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
const dbConnectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 1);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  waitForConnections: true,
  connectionLimit: Number.isFinite(dbConnectionLimit) && dbConnectionLimit > 0 ? dbConnectionLimit : 1,
  maxIdle: 1,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  queueLimit: 200,
  ssl: sslEnabled
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
      }
    : undefined,
});

const promisePool = pool.promise();

/**
 * Runs a pooled query and retries up to `maxRetries` times when the MySQL
 * server rejects the connection due to max_connections being reached
 * (ER_CON_COUNT_ERROR / errno 1040). Callers can await this just like
 * pool.promise().query().
 */
async function queryWithRetry(sql, params, { maxRetries = 3, delayMs = 600 } = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await promisePool.query(sql, params);
    } catch (err) {
      if (err.errno === 1040 && attempt < maxRetries) {
        console.warn(`DB: Too many connections - retry ${attempt}/${maxRetries - 1} in ${delayMs}ms`);
        await new Promise(r => setTimeout(r, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
}

module.exports = {
  pool,
  promisePool,
  queryWithRetry,
};
