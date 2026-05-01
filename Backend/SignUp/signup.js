const bcrypt = require('bcrypt');
const { promisePool } = require('../database');
const { adminEmailTaken } = require('../db/adminsAuth');

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

function buildUsersInsertSql(cols) {
  const base = ['email', 'password_hash', 'role', 'first_name', 'last_name', 'pass_status'];
  const ts = [];
  if (cols.has('created_at')) ts.push('created_at');
  if (cols.has('updated_at')) ts.push('updated_at');
  const allCols = [...base, ...ts].map((c) => `\`${c}\``).join(', ');
  const nowParts = ts.map(() => 'NOW()').join(', ');
  const valuesCore = `?, ?, 'user', ?, ?, 'None'`;
  const valuesSql =
    ts.length > 0 ? `${valuesCore}, ${nowParts}` : valuesCore;
  return `INSERT INTO users (${allCols}) VALUES (${valuesSql})`;
}

const handleSignup = async (req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedBody = JSON.parse(body);
      const { firstName, lastName, email, password } = parsedBody;

      if (!firstName || !lastName || !email || !password) {
        throw new Error('Missing required fields');
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const passwordHash = await bcrypt.hash(String(password), 12);

      const [existing] = await promisePool.execute(
        `SELECT 1 AS ok FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
        [normalizedEmail]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Email already exists' }));
        return;
      }

      if (await adminEmailTaken(normalizedEmail)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Email already exists' }));
        return;
      }

      try {
        const colSet = await getUsersColumnSet();
        const insertSql = buildUsersInsertSql(colSet);
        const [result] = await promisePool.execute(insertSql, [
          normalizedEmail,
          passwordHash,
          String(firstName).trim(),
          String(lastName).trim(),
        ]);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            message: 'Signup Success',
            user: {
              userID: result.insertId,
              firstName: String(firstName).trim(),
              lastName: String(lastName).trim(),
              email: normalizedEmail,
              passStatus: 'None',
              accountType: 'user',
            },
          })
        );
      } catch (dbErr) {
        if (dbErr && dbErr.code === 'ER_DUP_ENTRY') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Email already exists' }));
          return;
        }
        throw dbErr;
      }
    } catch (err) {
      console.error('Error during signup:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message || 'Signup Failed' }));
    }
  });
};

module.exports = {
  handleSignup,
};
