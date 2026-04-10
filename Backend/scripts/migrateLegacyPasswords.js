/**
 * One-time: bcrypt-hash plain-text passwords already stored in the DB.
 *
 * - Skips rows where password_hash already looks like bcrypt ($2a$, $2b$, $2y$).
 * - If a legacy `password` column exists and has a value, that value is hashed
 *   (and `password` is set to NULL when we clear it).
 * - Otherwise treats non-bcrypt `password_hash` as plain text and replaces it with a hash.
 *
 * Run from the Backend folder:
 *   npm run migrate-passwords
 *   node scripts/migrateLegacyPasswords.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const { promisePool, pool } = require('../database');

const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

function isBcryptHash(value) {
  if (value == null || typeof value !== 'string') return false;
  return BCRYPT_PREFIX.test(value.trim());
}

async function tableExists(name) {
  const [rows] = await promisePool.query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [name]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(table, col) {
  const [rows] = await promisePool.query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, col]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function primaryKeyColumn(table) {
  const [rows] = await promisePool.query(`SHOW COLUMNS FROM \`${table}\` WHERE \`Key\` = 'PRI'`);
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) return null;
  return row.Field != null ? row.Field : row.field;
}

async function migrateTable(table, idColumnGuess) {
  if (!(await tableExists(table))) {
    console.log(`Skip: table "${table}" does not exist.`);
    return 0;
  }

  const pk = (await primaryKeyColumn(table)) || idColumnGuess;
  if (!pk) {
    console.error(`Skip: could not detect primary key for "${table}".`);
    return 0;
  }

  const hasPasswordPlain = await columnExists(table, 'password');
  const hasPasswordHash = await columnExists(table, 'password_hash');
  if (!hasPasswordHash) {
    console.error(`Skip: "${table}" has no password_hash column.`);
    return 0;
  }

  const fields = [pk, 'password_hash'];
  if (hasPasswordPlain) fields.push('password');

  const [rows] = await promisePool.query(
    `SELECT ${fields.map((c) => `\`${c}\``).join(', ')} FROM \`${table}\``
  );

  let updated = 0;
  for (const row of rows || []) {
    const id = row[pk];
    const hashVal = row.password_hash;

    if (isBcryptHash(hashVal)) {
      continue;
    }

    let plain = null;
    if (hasPasswordPlain && row.password != null && String(row.password).trim() !== '') {
      plain = String(row.password);
    } else if (hashVal != null && String(hashVal).trim() !== '') {
      plain = String(hashVal);
    }

    if (!plain) {
      continue;
    }

    const newHash = await bcrypt.hash(plain, 12);

    if (hasPasswordPlain) {
      await promisePool.execute(
        `UPDATE \`${table}\` SET password_hash = ?, \`password\` = NULL WHERE \`${pk}\` = ?`,
        [newHash, id]
      );
    } else {
      await promisePool.execute(
        `UPDATE \`${table}\` SET password_hash = ? WHERE \`${pk}\` = ?`,
        [newHash, id]
      );
    }
    updated += 1;
    console.log(`  ${table} ${pk}=${id}: hashed (${String(plain).length} char plain source hidden)`);
  }

  return updated;
}

async function main() {
  console.log('Migrating legacy plain-text passwords to bcrypt (password_hash)...\n');

  const u = await migrateTable('users', 'user_id');
  const a = await migrateTable('admins', 'admin_id');

  console.log(`\nDone. Updated users: ${u}, admins: ${a}.`);
  console.log('Rows that were already bcrypt were skipped.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
