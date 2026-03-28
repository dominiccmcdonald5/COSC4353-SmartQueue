const { allMockData, persistMockData } = require('../mockData');

const PASS_TYPES = new Set(['none', 'silver', 'gold']);
const ACCOUNT_STATUSES = new Set(['active', 'suspended', 'banned']);

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

function totalSpentFromHistory(userID) {
  return allMockData.HISTORY.reduce(
    (sum, h) => (h.userID === userID ? sum + Number(h.totalCost || 0) : sum),
    0,
  );
}

/** mockDataStore uses passStatus: "None" | "Silver" | "Gold"; optional passType: none|silver|gold */
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

/** Keep login/signup expectations: Gold | Silver | None */
function passTierToStorePassStatus(tier) {
  if (tier === 'gold') return 'Gold';
  if (tier === 'silver') return 'Silver';
  return 'None';
}

function rowToAdminShape(row) {
  const firstName = typeof row.firstName === 'string' ? row.firstName : '';
  const lastName = typeof row.lastName === 'string' ? row.lastName : '';
  const name = `${firstName} ${lastName}`.trim() || 'Unknown';
  const joinDate =
    typeof row.createdAt === 'string' && row.createdAt.length >= 10
      ? row.createdAt.slice(0, 10)
      : '';
  const passType = derivePassType(row);
  const status = ACCOUNT_STATUSES.has(row.accountStatus) ? row.accountStatus : 'active';
  const totalSpent =
    typeof row.totalSpent === 'number' && Number.isFinite(row.totalSpent)
      ? row.totalSpent
      : totalSpentFromHistory(row.userID);
  return {
    userID: row.userID,
    id: String(row.userID),
    name,
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

function getAllUsers(req, res) {
  const users = [...allMockData.USER]
    .sort((a, b) => a.userID - b.userID)
    .map(rowToAdminShape);
  sendJson(res, 200, {
    success: true,
    count: users.length,
    users,
  });
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

function emailTaken(email, excludeUserID) {
  const e = email.trim().toLowerCase();
  return allMockData.USER.some(
    (u) =>
      u.userID !== excludeUserID &&
      typeof u.email === 'string' &&
      u.email.trim().toLowerCase() === e,
  );
}

async function createUser(req, res) {
  try {
    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload, { requireFields: true });
    if (errors.length) {
      sendJson(res, 400, { success: false, errors });
      return;
    }
    if (emailTaken(payload.email, -1)) {
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

    const nextID = allMockData.USER.reduce((m, u) => Math.max(m, u.userID), 0) + 1;
    const passType =
      payload.passType != null && PASS_TYPES.has(String(payload.passType).toLowerCase())
        ? String(payload.passType).toLowerCase()
        : 'none';
    const accountStatus =
      payload.status != null && ACCOUNT_STATUSES.has(String(payload.status).toLowerCase())
        ? String(payload.status).toLowerCase()
        : 'active';
    const pwd =
      typeof payload.password === 'string' && payload.password.length >= 4
        ? payload.password
        : `sqUser${String(nextID).padStart(4, '0')}!`;

    const row = {
      userID: nextID,
      firstName,
      lastName,
      email: payload.email.trim(),
      password: pwd,
      passStatus: passTierToStorePassStatus(passType),
      passType,
      accountStatus,
      totalSpent:
        payload.totalSpent != null
          ? Math.round(Number(payload.totalSpent) * 100) / 100
          : 0,
      createdAt: new Date().toISOString(),
    };
    allMockData.USER.push(row);
    persistMockData(allMockData);

    sendJson(res, 201, {
      success: true,
      message: 'User created',
      user: rowToAdminShape(row),
    });
  } catch (e) {
    sendJson(res, 400, { success: false, message: e.message || 'Unable to create user' });
  }
}

async function editUser(req, res, rawId) {
  const userID = Number(rawId);
  if (!Number.isInteger(userID) || userID <= 0) {
    sendJson(res, 400, { success: false, message: 'userID must be a positive integer' });
    return;
  }

  const idx = allMockData.USER.findIndex((u) => u.userID === userID);
  if (idx === -1) {
    sendJson(res, 404, { success: false, message: 'User not found' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload, { requireFields: false });
    if (errors.length) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    if (payload.email != null && emailTaken(payload.email, userID)) {
      sendJson(res, 409, { success: false, message: 'Email already in use' });
      return;
    }

    const row = { ...allMockData.USER[idx] };

    if (payload.name != null) {
      const { firstName, lastName } = splitName(payload.name);
      row.firstName = firstName;
      row.lastName = lastName;
    }
    if (payload.firstName != null) row.firstName = String(payload.firstName).trim();
    if (payload.lastName != null) row.lastName = String(payload.lastName).trim();

    if (payload.email != null) row.email = payload.email.trim();
    if (payload.password != null) row.password = String(payload.password);
    if (payload.passType != null) {
      const pt = String(payload.passType).toLowerCase();
      row.passType = pt;
      row.passStatus = passTierToStorePassStatus(pt);
    }
    if (payload.status != null) row.accountStatus = String(payload.status).toLowerCase();
    if (payload.totalSpent != null) {
      row.totalSpent = Math.round(Number(payload.totalSpent) * 100) / 100;
    }

    allMockData.USER[idx] = row;
    persistMockData(allMockData);

    sendJson(res, 200, {
      success: true,
      message: 'User updated successfully',
      user: rowToAdminShape(row),
    });
  } catch (e) {
    sendJson(res, 400, { success: false, message: e.message || 'Unable to update user' });
  }
}

function deleteUser(req, res, rawId) {
  const userID = Number(rawId);
  if (!Number.isInteger(userID) || userID <= 0) {
    sendJson(res, 400, { success: false, message: 'userID must be a positive integer' });
    return;
  }

  const idx = allMockData.USER.findIndex((u) => u.userID === userID);
  if (idx === -1) {
    sendJson(res, 404, { success: false, message: 'User not found' });
    return;
  }

  const [removed] = allMockData.USER.splice(idx, 1);
  const before = allMockData.HISTORY.length;
  allMockData.HISTORY = allMockData.HISTORY.filter((h) => h.userID !== userID);
  persistMockData(allMockData);

  sendJson(res, 200, {
    success: true,
    message: 'User deleted successfully',
    userID,
    historyEntriesRemoved: before - allMockData.HISTORY.length,
    removedEmail: removed.email,
  });
}

module.exports = {
  getAllUsers,
  createUser,
  editUser,
  deleteUser,
};
