const { promisePool } = require('../database');

async function tableExists(name) {
  const [rows] = await promisePool.query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [name]
  );
  return Array.isArray(rows) && rows.length > 0;
}

let metaCache = null;

/**
 * Inspect `admins` so we work with either admin_id or id as PK, optional role, etc.
 * Admins are keyed by admin_id only (no user_id on admins).
 */
async function getAdminsMeta() {
  if (metaCache !== null) return metaCache;
  if (!(await tableExists('admins'))) {
    metaCache = { ok: false };
    return metaCache;
  }

  const [cols] = await promisePool.query('SHOW COLUMNS FROM admins');
  if (!Array.isArray(cols) || cols.length === 0) {
    metaCache = { ok: false };
    return metaCache;
  }

  const fields = cols.map((c) => (c.Field != null ? c.Field : c.field));
  const lower = fields.map((f) => String(f).toLowerCase());

  const pkRow = cols.find((c) => (c.Key != null ? c.Key : c.key) === 'PRI');
  let pkCol = pkRow ? (pkRow.Field != null ? pkRow.Field : pkRow.field) : null;
  if (!pkCol) {
    const idx = lower.indexOf('admin_id');
    pkCol = idx >= 0 ? fields[idx] : fields[0];
  }

  let emailCol = null;
  for (const candidate of ['email', 'admin_email', 'username']) {
    const idx = lower.indexOf(candidate);
    if (idx >= 0) {
      emailCol = fields[idx];
      break;
    }
  }

  const passHashCol = lower.includes('password_hash') ? fields[lower.indexOf('password_hash')] : null;
  const passPlainCol = lower.includes('password') ? fields[lower.indexOf('password')] : null;
  const roleCol = lower.includes('role') ? fields[lower.indexOf('role')] : null;

  metaCache = {
    ok: Boolean(emailCol),
    pkCol,
    emailCol,
    passHashCol,
    passPlainCol,
    roleCol,
  };
  return metaCache;
}

function pick(row, col) {
  if (!row || col == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, col)) return row[col];
  const found = Object.keys(row).find((k) => k.toLowerCase() === String(col).toLowerCase());
  return found != null ? row[found] : undefined;
}

/**
 * Normalized admin row for login: admin_id (from PK), email, password_hash, role.
 */
async function findAdminByEmail(normalizedEmail) {
  const meta = await getAdminsMeta();
  if (!meta.ok) return null;

  const [rows] = await promisePool.execute(
    `SELECT * FROM admins WHERE LOWER(TRIM(\`${meta.emailCol}\`)) = ? LIMIT 1`,
    [normalizedEmail]
  );
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) return null;

  const pk = pick(row, meta.pkCol);
  const email = pick(row, meta.emailCol);
  const hash = meta.passHashCol ? pick(row, meta.passHashCol) : null;
  const role = meta.roleCol ? pick(row, meta.roleCol) : 'admin';

  return {
    admin_id: pk,
    email,
    password_hash: hash != null ? hash : null,
    role,
  };
}

/**
 * Cheap existence check for signup — only needs the login/email column, not admin_id.
 */
async function adminEmailTaken(normalizedEmail) {
  const meta = await getAdminsMeta();
  if (!meta.ok) return false;
  const [rows] = await promisePool.execute(
    `SELECT 1 AS ok FROM admins WHERE LOWER(TRIM(\`${meta.emailCol}\`)) = ? LIMIT 1`,
    [normalizedEmail]
  );
  return Array.isArray(rows) && rows.length > 0;
}

function clearAdminsMetaCache() {
  metaCache = null;
}

module.exports = {
  findAdminByEmail,
  adminEmailTaken,
  tableExists,
  getAdminsMeta,
  clearAdminsMetaCache,
};
