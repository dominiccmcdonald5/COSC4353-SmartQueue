const bcrypt = require('bcrypt');
const { promisePool } = require('../database');
const { adminEmailTaken } = require('../db/adminsAuth');

const PASS_TYPES = new Set(['none', 'silver', 'gold']);
const ACCOUNT_STATUSES = new Set(['active', 'suspended', 'banned']);

let usersColumnsCache = null;

async function getUsersColumnSet() {
  if (usersColumnsCache) return usersColumnsCache;
  const [rows] = await promisePool.query(
    `SELECT LOWER(COLUMN_NAME) AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  );
  usersColumnsCache = new Set((rows || []).map((r) => String(r.name)));
  return usersColumnsCache;
}

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
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', () => reject(new Error('Failed to read request body')));
  });
}

function derivePassType(row) {
  if (row.passType != null && PASS_TYPES.has(String(row.passType).toLowerCase())) {
    return String(row.passType).toLowerCase();
  }
  const raw = row.passStatus;
  if (typeof raw !== 'string') return 'none';
  const s = raw.trim().toLowerCase();
  if (s === 'gold') return 'gold';
  if (s === 'silver') return 'silver';
  if (s === 'none') return 'none';
  return 'none';
}

function passTierToStorePassStatus(tier) {
  if (tier === 'gold') return 'Gold';
  if (tier === 'silver') return 'Silver';
  return 'None';
}

function rowToAdminShape(row) {
  const firstName = typeof row.firstName === 'string' ? row.firstName : '';
  const lastName = typeof row.lastName === 'string' ? row.lastName : '';
  const name = `${firstName} ${lastName}`.trim() || 'Unknown';
  const createdAt = row.createdAt;
  const joinDate =
    createdAt instanceof Date
      ? createdAt.toISOString().slice(0, 10)
      : typeof createdAt === 'string' && createdAt.length >= 10
        ? createdAt.slice(0, 10)
        : '';
  const passType = derivePassType(row);
  const rawStatus = row.accountStatus != null ? String(row.accountStatus).toLowerCase() : 'active';
  const status = ACCOUNT_STATUSES.has(rawStatus) ? rawStatus : 'active';
  const totalSpent =
    typeof row.totalSpent === 'number' && Number.isFinite(row.totalSpent)
      ? row.totalSpent
      : row.totalSpent != null
        ? Number(row.totalSpent) || 0
        : 0;
  return {
    userID: row.userID,
    id: String(row.userID),
    name,
    firstName,
    lastName,
    email: typeof row.email === 'string' ? row.email : '',
    joinDate,
    passType,
    totalSpent: Math.round(totalSpent * 100) / 100,
    status,
  };
}

function splitName(nameStr) {
  const t = typeof nameStr === 'string' ? nameStr.trim() : '';
  if (!t) return { firstName: '', lastName: '' };
  const parts = t.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function buildUserSelectSql() {
  const cols = await getUsersColumnSet();
  const parts = [
    'user_id AS userID',
    'email',
    'first_name AS firstName',
    'last_name AS lastName',
    'pass_status AS passStatus',
  ];
  if (cols.has('created_at')) parts.push('created_at AS createdAt');
  if (cols.has('account_status')) parts.push('account_status AS accountStatus');
  if (cols.has('total_spent')) parts.push('total_spent AS totalSpent');
  return `SELECT ${parts.join(', ')} FROM users
          WHERE LOWER(TRIM(COALESCE(role, 'user'))) = 'user'
          ORDER BY user_id ASC`;
}

async function getAllUsers(req, res) {
  try {
    const sql = await buildUserSelectSql();
    const [rows] = await promisePool.query(sql);
    const users = (rows || []).map(rowToAdminShape);
    sendJson(res, 200, {
      success: true,
      count: users.length,
      users,
    });
  } catch (e) {
    console.error('getAllUsers:', e);
    sendJson(res, 500, { success: false, message: e.message || 'Failed to load users' });
  }
}

function validateEditPayload(payload, { requireFields } = { requireFields: false }) {
  const errors = [];
  const keys = Object.keys(payload);

  if (requireFields) {
    if (typeof payload.email !== 'string' || !payload.email.trim()) {
      errors.push('email is required');
    }
    const ident = payload.name || payload.firstName;
    if (typeof ident !== 'string' || !ident.trim()) {
      errors.push('name (or firstName) is required');
    }
    if (typeof payload.password !== 'string' || payload.password.length < 4) {
      errors.push('password is required and must be at least 4 characters');
    }
  } else if (keys.length === 0) {
    errors.push('At least one updatable field is required');
    return errors;
  }

  const allowed = ['name', 'firstName', 'lastName', 'email', 'password', 'passType', 'status', 'totalSpent'];
  const bad = keys.filter((k) => !allowed.includes(k));
  if (bad.length) errors.push(`Invalid field(s): ${bad.join(', ')}`);

  if (payload.email !== undefined) {
    if (typeof payload.email !== 'string' || !payload.email.trim()) {
      errors.push('email must be a non-empty string');
    } else if (payload.email.length > 120) {
      errors.push('email is too long');
    }
  }
  if (payload.password !== undefined && payload.password !== null) {
    if (typeof payload.password !== 'string' || payload.password.length < 4) {
      errors.push('password must be a string of at least 4 characters if provided');
    }
  }
  if (payload.passType !== undefined && !PASS_TYPES.has(String(payload.passType).toLowerCase())) {
    errors.push('passType must be one of: none, silver, gold');
  }
  if (payload.status !== undefined && !ACCOUNT_STATUSES.has(String(payload.status).toLowerCase())) {
    errors.push('status must be one of: active, suspended, banned');
  }
  if (payload.totalSpent !== undefined) {
    const n = Number(payload.totalSpent);
    if (!Number.isFinite(n) || n < 0) {
      errors.push('totalSpent must be a non-negative number');
    }
  }

  return errors;
}

async function emailTakenByOtherUser(email, excludeUserID) {
  const e = email.trim().toLowerCase();
  const [rows] = await promisePool.execute(
    `SELECT user_id FROM users
     WHERE LOWER(TRIM(email)) = ? AND user_id <> ?
     LIMIT 1`,
    [e, excludeUserID]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function createUser(req, res) {
  try {
    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload, { requireFields: true });
    if (errors.length) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const normalizedEmail = String(payload.email).trim().toLowerCase();
    const [existing] = await promisePool.execute(
      `SELECT 1 AS ok FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
      [normalizedEmail]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      sendJson(res, 409, { success: false, message: 'Email already in use' });
      return;
    }
    if (await adminEmailTaken(normalizedEmail)) {
      sendJson(res, 409, { success: false, message: 'Email already in use' });
      return;
    }

    let firstName;
    let lastName;
    if (typeof payload.name === 'string' && payload.name.trim()) {
      ({ firstName, lastName } = splitName(payload.name));
    } else {
      firstName = String(payload.firstName || '').trim();
      lastName = String(payload.lastName || '').trim();
    }

    const passType =
      payload.passType != null && PASS_TYPES.has(String(payload.passType).toLowerCase())
        ? String(payload.passType).toLowerCase()
        : 'none';
    const passStatus = passTierToStorePassStatus(passType);
    const accountStatus =
      payload.status != null && ACCOUNT_STATUSES.has(String(payload.status).toLowerCase())
        ? String(payload.status).toLowerCase()
        : 'active';
    const passwordHash = await bcrypt.hash(String(payload.password), 12);

    const cols = await getUsersColumnSet();
    const insertCols = ['email', 'password_hash', 'role', 'first_name', 'last_name', 'pass_status'];
    const insertVals = [normalizedEmail, passwordHash, 'user', firstName, lastName, passStatus];
    if (cols.has('account_status')) {
      insertCols.push('account_status');
      insertVals.push(accountStatus);
    }
    if (cols.has('total_spent')) {
      insertCols.push('total_spent');
      insertVals.push(
        payload.totalSpent != null ? Math.round(Number(payload.totalSpent) * 100) / 100 : 0
      );
    }
    if (cols.has('created_at')) {
      insertCols.push('created_at');
      insertVals.push(new Date());
    }
    if (cols.has('updated_at')) {
      insertCols.push('updated_at');
      insertVals.push(new Date());
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    const colSql = insertCols.map((c) => `\`${c}\``).join(', ');
    const [result] = await promisePool.execute(
      `INSERT INTO users (${colSql}) VALUES (${placeholders})`,
      insertVals
    );

    const newId = result.insertId;
    const sel = [
      'user_id AS userID',
      'email',
      'first_name AS firstName',
      'last_name AS lastName',
      'pass_status AS passStatus',
    ];
    if (cols.has('created_at')) sel.push('created_at AS createdAt');
    if (cols.has('account_status')) sel.push('account_status AS accountStatus');
    if (cols.has('total_spent')) sel.push('total_spent AS totalSpent');
    const [userRows] = await promisePool.execute(
      `SELECT ${sel.join(', ')} FROM users WHERE user_id = ? LIMIT 1`,
      [newId]
    );
    const row = userRows[0];
    sendJson(res, 201, {
      success: true,
      message: 'User created',
      user: rowToAdminShape(row),
    });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      sendJson(res, 409, { success: false, message: 'Email already in use' });
      return;
    }
    console.error('createUser:', e);
    sendJson(res, 400, { success: false, message: e.message || 'Unable to create user' });
  }
}

async function editUser(req, res, rawId) {
  const userID = Number(rawId);
  if (!Number.isInteger(userID) || userID <= 0) {
    sendJson(res, 400, { success: false, message: 'userID must be a positive integer' });
    return;
  }

  try {
    const [check] = await promisePool.execute(
      `SELECT user_id FROM users WHERE user_id = ? AND LOWER(TRIM(COALESCE(role, 'user'))) = 'user' LIMIT 1`,
      [userID]
    );
    if (!Array.isArray(check) || check.length === 0) {
      sendJson(res, 404, { success: false, message: 'User not found' });
      return;
    }

    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload, { requireFields: false });
    if (errors.length) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    if (payload.email != null) {
      const norm = String(payload.email).trim().toLowerCase();
      if (await emailTakenByOtherUser(norm, userID)) {
        sendJson(res, 409, { success: false, message: 'Email already in use' });
        return;
      }
      if (await adminEmailTaken(norm)) {
        sendJson(res, 409, { success: false, message: 'Email already in use' });
        return;
      }
    }

    const cols = await getUsersColumnSet();
    const sets = [];
    const vals = [];

    const hasFirst = Object.prototype.hasOwnProperty.call(payload, 'firstName');
    const hasLast = Object.prototype.hasOwnProperty.call(payload, 'lastName');
    if (hasFirst || hasLast) {
      if (hasFirst) {
        sets.push('first_name = ?');
        vals.push(String(payload.firstName ?? '').trim());
      }
      if (hasLast) {
        sets.push('last_name = ?');
        vals.push(String(payload.lastName ?? '').trim());
      }
    } else if (payload.name != null) {
      const { firstName, lastName } = splitName(payload.name);
      sets.push('first_name = ?', 'last_name = ?');
      vals.push(firstName, lastName);
    }
    if (payload.email != null) {
      sets.push('email = ?');
      vals.push(String(payload.email).trim().toLowerCase());
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, 'password') &&
      typeof payload.password === 'string' &&
      payload.password.length >= 4
    ) {
      sets.push('password_hash = ?');
      vals.push(await bcrypt.hash(payload.password, 12));
    }
    if (payload.passType != null) {
      const pt = String(payload.passType).toLowerCase();
      sets.push('pass_status = ?');
      vals.push(passTierToStorePassStatus(pt));
    }
    if (payload.status != null && cols.has('account_status')) {
      sets.push('account_status = ?');
      vals.push(String(payload.status).toLowerCase());
    }
    if (payload.totalSpent != null && cols.has('total_spent')) {
      sets.push('total_spent = ?');
      vals.push(Math.round(Number(payload.totalSpent) * 100) / 100);
    }
    if (cols.has('updated_at')) {
      sets.push('updated_at = ?');
      vals.push(new Date());
    }

    if (sets.length === 0) {
      sendJson(res, 400, { success: false, message: 'No updatable fields applied' });
      return;
    }

    vals.push(userID);
    await promisePool.execute(
      `UPDATE users SET ${sets.join(', ')} WHERE user_id = ? AND LOWER(TRIM(COALESCE(role, 'user'))) = 'user'`,
      vals
    );

    const sel2 = [
      'user_id AS userID',
      'email',
      'first_name AS firstName',
      'last_name AS lastName',
      'pass_status AS passStatus',
    ];
    if (cols.has('created_at')) sel2.push('created_at AS createdAt');
    if (cols.has('account_status')) sel2.push('account_status AS accountStatus');
    if (cols.has('total_spent')) sel2.push('total_spent AS totalSpent');
    const [userRows] = await promisePool.execute(
      `SELECT ${sel2.join(', ')} FROM users WHERE user_id = ? LIMIT 1`,
      [userID]
    );
    const row = userRows[0];
    sendJson(res, 200, {
      success: true,
      message: 'User updated successfully',
      user: rowToAdminShape(row),
    });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      sendJson(res, 409, { success: false, message: 'Email already in use' });
      return;
    }
    console.error('editUser:', e);
    sendJson(res, 400, { success: false, message: e.message || 'Unable to update user' });
  }
}

async function deleteUser(req, res, rawId) {
  const userID = Number(rawId);
  if (!Number.isInteger(userID) || userID <= 0) {
    sendJson(res, 400, { success: false, message: 'userID must be a positive integer' });
    return;
  }

  try {
    const [before] = await promisePool.execute(
      `SELECT email FROM users WHERE user_id = ? AND LOWER(TRIM(COALESCE(role, 'user'))) = 'user' LIMIT 1`,
      [userID]
    );
    if (!Array.isArray(before) || before.length === 0) {
      sendJson(res, 404, { success: false, message: 'User not found' });
      return;
    }

    await promisePool.execute(
      `DELETE FROM users WHERE user_id = ? AND LOWER(TRIM(COALESCE(role, 'user'))) = 'user'`,
      [userID]
    );

    sendJson(res, 200, {
      success: true,
      message: 'User deleted successfully',
      userID,
      historyEntriesRemoved: 0,
      removedEmail: before[0].email,
    });
  } catch (e) {
    console.error('deleteUser:', e);
    sendJson(res, 500, { success: false, message: e.message || 'Unable to delete user' });
  }
}

module.exports = {
  getAllUsers,
  createUser,
  editUser,
  deleteUser,
};
