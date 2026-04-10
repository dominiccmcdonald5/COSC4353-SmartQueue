const bcrypt = require('bcrypt');
const { promisePool } = require('../database');
const { findAdminByEmail } = require('../db/adminsAuth');

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const handleLogin = async (req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedBody = JSON.parse(body);
      const { email, password } = parsedBody;
      const userIdentifier = email;

      if (!userIdentifier || !password) {
        throw new Error('Missing required fields');
      }

      const normalized = String(userIdentifier).trim().toLowerCase();
      const plain = String(password);

      const [userRows] = await promisePool.execute(
        `SELECT user_id, email, password_hash, role, first_name, last_name, pass_status
         FROM users
         WHERE LOWER(TRIM(email)) = ?
         LIMIT 1`,
        [normalized]
      );

      const user = Array.isArray(userRows) && userRows[0] ? userRows[0] : null;

      if (user) {
        const hash = user.password_hash != null ? String(user.password_hash) : '';
        if (!hash) {
          sendJson(res, 401, { success: false, message: 'Invalid credentials' });
          return;
        }

        const ok = await bcrypt.compare(plain, hash);
        if (!ok) {
          sendJson(res, 401, { success: false, message: 'Invalid credentials' });
          return;
        }

        const role = String(user.role || 'user').toLowerCase();
        const accountType = role === 'admin' ? 'admin' : 'user';
        const passStatus =
          user.pass_status === 'Gold' || user.pass_status === 'Silver' || user.pass_status === 'None'
            ? user.pass_status
            : 'None';

        sendJson(res, 200, {
          success: true,
          userId: user.user_id,
          userName:
            `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          email: user.email,
          role: accountType === 'admin' ? 'Administrator' : 'User',
          passStatus,
          accountType,
          message: accountType === 'admin' ? 'Admin Account' : 'User Account',
        });
        return;
      }

      const adminRow = await findAdminByEmail(normalized);
      if (!adminRow) {
        sendJson(res, 404, { success: false, message: 'User not found' });
        return;
      }

      const aHash = adminRow.password_hash != null ? String(adminRow.password_hash) : '';
      if (!aHash) {
        sendJson(res, 401, { success: false, message: 'Invalid credentials' });
        return;
      }

      const adminOk = await bcrypt.compare(plain, aHash);
      if (!adminOk) {
        sendJson(res, 401, { success: false, message: 'Invalid credentials' });
        return;
      }

      const adminPk = Number(adminRow.admin_id);

      sendJson(res, 200, {
        success: true,
        userId: adminPk,
        adminId: adminPk,
        userName: String(adminRow.email || 'Admin'),
        email: String(adminRow.email || ''),
        role: 'Administrator',
        passStatus: 'None',
        accountType: 'admin',
        message: 'Admin Account',
      });
    } catch (err) {
      console.error('Error during login:', err);
      sendJson(res, 500, { success: false, message: err.message || 'Login Failed' });
    }
  });
};

module.exports = {
  handleLogin,
};
