const { promisePool } = require('../database');

const VALID_PASS_STATUSES = ['Gold', 'Silver', 'None'];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', () => reject(new Error('Failed to read request body')));
  });
}

function normalizePassStatus(raw) {
  const rawStr = String(raw || '').trim();
  const low = rawStr.toLowerCase();
  if (low === 'gold') return 'Gold';
  if (low === 'silver') return 'Silver';
  if (low === 'none') return 'None';
  return rawStr;
}

async function passStatusColumnExists() {
  const [rows] = await promisePool.query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND LOWER(COLUMN_NAME) = 'pass_status'
     LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function passExpiresColumnExists() {
  const [rows] = await promisePool.query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND LOWER(COLUMN_NAME) = 'pass_expires_at'
     LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

function passExpiresMs(value) {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function hasActivePassRow(row) {
  const status = normalizePassStatus(row?.pass_status);
  const expMs = passExpiresMs(row?.pass_expires_at);
  return (
    (status === 'Gold' || status === 'Silver') && Number.isFinite(expMs) && expMs > Date.now()
  );
}

const updateUserPassStatus = async (req, res) => {
  try {
    const payload = await readJsonBody(req);
    const userID = Number(payload.userID);
    const passStatus = normalizePassStatus(payload.passStatus);

    if (!Number.isInteger(userID) || userID <= 0) {
      sendJson(res, 400, { success: false, message: 'Valid userID is required' });
      return;
    }

    if (!VALID_PASS_STATUSES.includes(passStatus)) {
      sendJson(res, 400, { success: false, message: 'passStatus must be one of Gold, Silver, None' });
      return;
    }

    if (!(await passStatusColumnExists())) {
      sendJson(res, 500, { success: false, message: "Database missing users.pass_status column" });
      return;
    }
    if (!(await passExpiresColumnExists())) {
      sendJson(res, 500, { success: false, message: "Database missing users.pass_expires_at column" });
      return;
    }

    const [existingRows] = await promisePool.execute(
      `SELECT pass_status, pass_expires_at
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userID]
    );
    if (!Array.isArray(existingRows) || existingRows.length === 0) {
      sendJson(res, 404, { success: false, message: 'User not found' });
      return;
    }

    const currentRow = existingRows[0];
    const currentStatus = normalizePassStatus(currentRow.pass_status);
    const active = hasActivePassRow(currentRow);

    let result;

    if (passStatus === 'None') {
      if (active) {
        sendJson(res, 403, {
          success: false,
          message: 'An active pass cannot be removed after purchase.',
        });
        return;
      }
      [result] = await promisePool.execute(
        `UPDATE users
         SET pass_status = 'None',
             pass_expires_at = NULL
         WHERE user_id = ?
         LIMIT 1`,
        [userID]
      );
    } else if (passStatus === 'Silver' && currentStatus === 'Gold' && active) {
      sendJson(res, 400, {
        success: false,
        message: 'Cannot downgrade from Gold to Silver while your pass is active.',
      });
      return;
    } else if (passStatus === 'Gold' && currentStatus === 'Silver' && active) {
      // Upgrade: same expiry date, only tier changes
      [result] = await promisePool.execute(
        `UPDATE users
         SET pass_status = 'Gold'
         WHERE user_id = ?
         LIMIT 1`,
        [userID]
      );
    } else if ((passStatus === 'Gold' || passStatus === 'Silver') && active && passStatus === currentStatus) {
      // Renew same tier: extend one year from later of now or current expiry
      [result] = await promisePool.execute(
        `UPDATE users
         SET pass_status = ?,
             pass_expires_at = DATE_ADD(GREATEST(NOW(), COALESCE(pass_expires_at, NOW())), INTERVAL 1 YEAR)
         WHERE user_id = ?
         LIMIT 1`,
        [passStatus, userID]
      );
    } else {
      // New purchase or re-buy after expiry
      [result] = await promisePool.execute(
        `UPDATE users
         SET pass_status = ?,
             pass_expires_at = DATE_ADD(GREATEST(NOW(), COALESCE(pass_expires_at, NOW())), INTERVAL 1 YEAR)
         WHERE user_id = ?
         LIMIT 1`,
        [passStatus, userID]
      );
    }

    if (!result || result.affectedRows === 0) {
      sendJson(res, 404, { success: false, message: 'User not found' });
      return;
    }

    const [rows] = await promisePool.execute(
      `SELECT pass_status, pass_expires_at
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userID]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    const expires =
      row && row.pass_expires_at instanceof Date
        ? row.pass_expires_at.toISOString()
        : row && row.pass_expires_at != null
          ? String(row.pass_expires_at)
          : null;

    sendJson(res, 200, {
      success: true,
      message: 'Pass status updated successfully',
      userID,
      passStatus: row && row.pass_status ? String(row.pass_status) : passStatus,
      passExpiresAt: expires,
    });
  } catch (err) {
    console.error('Error updating pass status:', err);
    sendJson(res, 500, { success: false, message: err.message || 'Failed to update pass status' });
  }
};

module.exports = { updateUserPassStatus };
