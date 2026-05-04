const { pool, promisePool, queryWithRetry } = require('../database');

const PRIORITY = {
  NONE: 0,
  PASS: 1,
};

const ENABLE_STALE_QUEUE_EXPIRY = false;
const STALE_QUEUE_MINUTES = 120;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
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
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', () => reject(new Error('read error')));
  });
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function elapsedMinutesFrom(dateLike) {
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.round(Math.abs(Date.now() - timestamp) / 60000);
}

function toTitleWord(word) {
  if (!word) return '';
  const lower = String(word).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function displayNameFromEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0] || '';
  if (!local) return '';

  const pieces = local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map((part) => part.replace(/\d+/g, '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .map(toTitleWord);

  return pieces.join(' ');
}

function passStatusToLabel(passStatus) {
  const s = String(passStatus || 'None');
  if (s === 'Gold') return 'gold';
  if (s === 'Silver') return 'silver';
  return null;
}

async function expireStaleQueueEntries(filters = {}) {
  if (!ENABLE_STALE_QUEUE_EXPIRY) return 0;

  const where = [
    `status = 'queued'`,
    `in_line_status = 'in_line'`,
    `queued_at < DATE_SUB(NOW(), INTERVAL ${STALE_QUEUE_MINUTES} MINUTE)`,
  ];
  const params = [];

  if (Number.isInteger(filters.concertID) && filters.concertID > 0) {
    where.push('concert_id = ?');
    params.push(filters.concertID);
  }

  if (Number.isInteger(filters.userID) && filters.userID > 0) {
    where.push('user_id = ?');
    params.push(filters.userID);
  }

  const [result] = await pool.promise().query(
    `
    UPDATE queue_history
    SET status = 'cancelled', in_line_status = 'left'
    WHERE ${where.join(' AND ')}
    `,
    params
  );

  return toNumber(result?.affectedRows);
}

async function getCompletedPurchaseCountForConcert(concertID) {
  const [rows] = await pool
    .promise()
    .query(
      `SELECT COUNT(*) AS c
       FROM queue_history
       WHERE concert_id = ?
         AND status = 'completed'`,
      [concertID]
    );
  return toNumber(rows?.[0]?.c);
}

function sortQueueRowsFifo(rows) {
  return [...(rows || [])].sort((a, b) => {
    const aTs = a.queued_at ?? a.joinedAt;
    const bTs = b.queued_at ?? b.joinedAt;
    const ta = aTs instanceof Date ? aTs.getTime() : new Date(aTs).getTime();
    const tb = bTs instanceof Date ? bTs.getTime() : new Date(bTs).getTime();
    if (ta !== tb) return ta - tb;
    return toNumber(a.history_id) - toNumber(b.history_id);
  });
}

/**
 * Fair display/serve order for a concert: 2 "pass" slots then 1 "regular" slot, repeating,
 * matching `serveNext` + `getServeSlotForConcert` (based on completed purchases as a starting phase).
 */
function buildFairQueueOrder(queuedRows, completedCount) {
  const passWaiting = sortQueueRowsFifo((queuedRows || []).filter((r) => toNumber(r.priority_level) > 0));
  const regularWaiting = sortQueueRowsFifo((queuedRows || []).filter((r) => toNumber(r.priority_level) === 0));

  const passQ = [...passWaiting];
  const regQ = [...regularWaiting];
  const out = [];

  const takeNext = (preferredPass) => {
    const preferredQ = preferredPass ? passQ : regQ;
    const fallbackQ = preferredPass ? regQ : passQ;
    if (preferredQ.length > 0) out.push(preferredQ.shift());
    else if (fallbackQ.length > 0) out.push(fallbackQ.shift());
  };

  let servedSoFar = 0;
  while (passQ.length > 0 || regQ.length > 0) {
    const slotIsRegular = (toNumber(completedCount) + servedSoFar) % 3 === 2;
    takeNext(!slotIsRegular);
    servedSoFar += 1;
  }

  return out;
}

async function fetchCompletedPurchaseCountsGrouped() {
  const [rows] = await pool.promise().query(
    `
    SELECT concert_id AS concertId, COUNT(*) AS c
    FROM queue_history
    WHERE status = 'completed'
    GROUP BY concert_id
    `
  );

  const map = new Map();
  for (const r of rows || []) {
    map.set(toNumber(r.concertId), toNumber(r.c));
  }
  return map;
}

async function fetchQueuedRowsForConcertFair(concertID) {
  await expireStaleQueueEntries({ concertID });

  const [rows] = await pool.promise().query(
    `
    SELECT
      qh.history_id,
      qh.user_id AS userId,
      qh.queued_at AS joinedAt,
      qh.wait_time AS waitTimeSeconds,
      qh.priority_level,
      u.pass_status AS passStatus,
      c.concert_name AS concertName
    FROM queue_history qh
    LEFT JOIN users u ON u.user_id = qh.user_id
    LEFT JOIN concerts c ON c.concert_id = qh.concert_id
    WHERE qh.concert_id = ?
      AND qh.status = 'queued'
      AND qh.in_line_status = 'in_line'
    `,
    [concertID]
  );
  return Array.isArray(rows) ? rows : [];
}

function buildFairOrderedActiveQueueResponse(rawRows, completedByConcert) {
  const byConcert = new Map();
  for (const r of rawRows || []) {
    const cid = toNumber(r.concertId);
    if (!byConcert.has(cid)) byConcert.set(cid, []);
    byConcert.get(cid).push(r);
  }

  const flattened = [];
  for (const [cid, group] of byConcert.entries()) {
    const completed = completedByConcert.get(cid) || 0;
    const ordered = buildFairQueueOrder(group, completed);
    for (const row of ordered) flattened.push(row);
  }

  return flattened.map((row, index) => ({
    position: index + 1,
    queueEntryId: toNumber(row.history_id),
    concertId: toNumber(row.concertId),
    userId: toNumber(row.userId),
    label: `User #${toNumber(row.userId)} - ${row.concertName || 'Queue Entry'}`,
    joinedAt: row.joinedAt,
    priorityLevel:
      toNumber(row.priority_level) > 0 ? passStatusToLabel(row.passStatus) : null,
  }));
}

async function maybeInsertNotification({ userID, message }) {
  try {
    const [existingRows] = await pool
      .promise()
      .query(`SELECT 1 AS ok FROM notifications WHERE user_id = ? AND message = ? LIMIT 1`, [userID, message]);

    if (Array.isArray(existingRows) && existingRows.length > 0) return;

    await pool
      .promise()
      .query(`INSERT INTO notifications (user_id, message, status) VALUES (?, ?, 'sent')`, [userID, message]);
  } catch {
    // Notifications should never break queue operations if the table is missing/misconfigured.
  }
}

async function priorityColumnExists() {
  const [rows] = await pool.promise().query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'queue_history'
       AND LOWER(COLUMN_NAME) = 'priority_level'
     LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function seatSelectionColumnExists() {
  const [rows] = await pool.promise().query(
    `SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'queue_history'
       AND LOWER(COLUMN_NAME) = 'seat_selection'
     LIMIT 1`
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** @param {unknown} raw @returns {string | null} */
function normalizeSeatsForStorage(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = raw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const row = String(/** @type {any} */ (s).row ?? '').trim();
      const seatNumber = String(
        /** @type {any} */ (s).seatNumber ?? /** @type {any} */ (s).seat_number ?? ''
      ).trim();
      const section = /** @type {any} */ (s).section;
      if (!row || !seatNumber) return null;
      return {
        row,
        seatNumber,
        ...(section != null && String(section).trim() ? { section: String(section).trim() } : {}),
      };
    })
    .filter(Boolean);
  return out.length ? JSON.stringify(out) : null;
}

async function fetchEffectiveUserPriority(userID, concertID) {
  // If schema isn't updated yet, degrade gracefully to FIFO.
  if (!(await priorityColumnExists())) return PRIORITY.NONE;

  const [[userRows], [concertRows], [soldRows]] = await Promise.all([
    pool
      .promise()
      .query(
        `SELECT pass_status, pass_expires_at
         FROM users
         WHERE user_id = ?
         LIMIT 1`,
        [userID]
      ),
    pool.promise().query(`SELECT capacity FROM concerts WHERE concert_id = ? LIMIT 1`, [concertID]),
    pool
      .promise()
      .query(
        `
        SELECT COALESCE(SUM(ticket_count), 0) AS sold
        FROM queue_history
        WHERE concert_id = ?
          AND status = 'completed'
        `,
        [concertID]
      ),
  ]);

  if (!Array.isArray(userRows) || userRows.length === 0) return PRIORITY.NONE;
  if (!Array.isArray(concertRows) || concertRows.length === 0) return PRIORITY.NONE;

  const status = String(userRows[0].pass_status || 'None');
  const exp = userRows[0].pass_expires_at;
  const expMs = exp instanceof Date ? exp.getTime() : exp != null ? new Date(exp).getTime() : NaN;
  const active = (status === 'Gold' || status === 'Silver') && Number.isFinite(expMs) && expMs > Date.now();
  if (!active) return PRIORITY.NONE;

  const capacity = Math.max(0, toNumber(concertRows[0].capacity));
  if (capacity <= 0) return PRIORITY.NONE;
  const sold = Math.max(0, toNumber(soldRows?.[0]?.sold));
  const soldPct = sold / capacity;

  // Gold/Silver share the same queue priority when eligible; cutoff percentages differ.
  if (status === 'Gold' && soldPct < 0.5) return PRIORITY.PASS;
  if (status === 'Silver' && soldPct < 0.25) return PRIORITY.PASS;
  return PRIORITY.NONE;
}

async function getServeSlotForConcert(concertID) {
  // Fairness: serve 2 priority, then 1 regular, repeating per concert.
  // We base the pattern on count of completed entries so it persists across restarts.
  const [rows] = await pool
    .promise()
    .query(
      `SELECT COUNT(*) AS c
       FROM queue_history
       WHERE concert_id = ?
         AND status = 'completed'`,
      [concertID]
    );
  const completed = toNumber(rows?.[0]?.c);
  const mod = completed % 3; // 0,1 => priority turn; 2 => regular turn
  return mod === 2 ? 'regular' : 'priority';
}

async function getQueue(req, res) {
  try {
    await expireStaleQueueEntries();

    const [rows] = await pool.promise().query(
      `
      SELECT
        qh.history_id,
        qh.concert_id AS concertId,
        qh.queued_at AS joinedAt,
        qh.wait_time AS waitTimeSeconds,
        qh.user_id AS userId,
        qh.priority_level,
        u.pass_status AS passStatus,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.email AS email,
        c.concert_name AS concertName
      FROM queue_history qh
      LEFT JOIN users u ON u.user_id = qh.user_id
      LEFT JOIN concerts c ON c.concert_id = qh.concert_id
      WHERE qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
      `
    );

    // Use upstream fair-ordering logic
    const completedByConcert = await fetchCompletedPurchaseCountsGrouped();
    const queue = buildFairOrderedActiveQueueResponse(rows, completedByConcert);

    // Build lookup map and duplicate counts for enrichment.
    // Duplicate means same user_id appears multiple times in the same concert queue.
    const rowById = new Map(rows.map((r) => [toNumber(r.history_id), r]));
    const userInConcertCounts = {};
    rows.forEach((r) => {
      const uid = toNumber(r.userId);
      const cid = toNumber(r.concertId);
      const key = `${cid}:${uid}`;
      userInConcertCounts[key] = (userInConcertCounts[key] || 0) + 1;
    });

    // Bot detection: count recent queue joins per user in the last 30 minutes
    const uniqueUserIds = [...new Set(rows.map((r) => toNumber(r.userId)))];
    const suspectedBotIds = new Set();
    if (uniqueUserIds.length > 0) {
      const [recentJoins] = await pool.promise().query(
        `SELECT user_id, COUNT(*) AS join_count
         FROM queue_history
         WHERE user_id IN (?)
           AND queued_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         GROUP BY user_id
         HAVING join_count >= 3`,
        [uniqueUserIds]
      );
      for (const row of recentJoins) {
        suspectedBotIds.add(toNumber(row.user_id));
      }
    }

    const enrichedQueue = queue.map((entry) => {
      const raw = rowById.get(toNumber(entry.queueEntryId));
      if (!raw) return entry;
      const firstName = raw.firstName || '';
      const lastName = raw.lastName || '';
      const fallbackName = displayNameFromEmail(raw.email);
      const displayName = `${firstName} ${lastName}`.trim() || fallbackName;
      const accumulatedMinutes = Math.max(0, Math.floor(toNumber(raw.waitTimeSeconds) / 60));
      const currentSegmentMinutes = raw.joinedAt ? elapsedMinutesFrom(raw.joinedAt) : null;
      const waitMinutes = currentSegmentMinutes == null ? null : accumulatedMinutes + currentSegmentMinutes;
      const uid = toNumber(raw.userId);
      const cid = toNumber(raw.concertId);
      const duplicateKey = `${cid}:${uid}`;
      return {
        ...entry,
        concertId: cid,
        firstName: firstName || (displayName ? displayName.split(' ')[0] : ''),
        lastName: lastName || (displayName.includes(' ') ? displayName.split(' ').slice(1).join(' ') : ''),
        passStatus: raw.passStatus || 'none',
        concertName: raw.concertName || 'Unknown Concert',
        label: displayName || `User #${uid}`,
        joinedAt: raw.joinedAt,
        waitMinutes,
        isDuplicate: userInConcertCounts[duplicateKey] > 1,
        isSuspectedBot: suspectedBotIds.has(uid),
      };
    });

    sendJson(res, 200, {
      success: true,
      count: enrichedQueue.length,
      queue: enrichedQueue,
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

async function serveNext(req, res) {
  try {
    await expireStaleQueueEntries();

    const [nextConcertRows] = await pool.promise().query(
      `
      SELECT concert_id AS concertId
      FROM queue_history
      WHERE status = 'queued' AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      LIMIT 1
      `
    );

    if (!Array.isArray(nextConcertRows) || nextConcertRows.length === 0) {
      sendJson(res, 200, {
        success: true,
        message: 'Queue is empty; no one to serve.',
        served: null,
        queue: [],
      });
      return;
    }

    const concertID = toNumber(nextConcertRows[0].concertId);
    const slot = await getServeSlotForConcert(concertID);

    const preferredWhere =
      slot === 'priority' ? `COALESCE(priority_level, 0) > 0` : `COALESCE(priority_level, 0) = 0`;

    const [rows] = await pool.promise().query(
      `
      SELECT
        qh.history_id AS queueEntryId,
        qh.user_id AS userId,
        qh.concert_id AS concertId,
        qh.queued_at AS joinedAt,
        qh.priority_level,
        u.pass_status AS passStatus
      FROM queue_history qh
      LEFT JOIN users u ON u.user_id = qh.user_id
      WHERE qh.concert_id = ?
        AND qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
        AND (${preferredWhere})
      ORDER BY COALESCE(qh.priority_level, 0) DESC, qh.queued_at ASC, qh.history_id ASC
      LIMIT 1
      `,
      [concertID]
    );

    let served = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!served) {
      // Fallback to the other group if the preferred group is empty.
      const fallbackWhere =
        slot === 'priority' ? `COALESCE(priority_level, 0) = 0` : `COALESCE(priority_level, 0) > 0`;
      const [fallbackRows] = await pool.promise().query(
        `
        SELECT
          qh.history_id AS queueEntryId,
          qh.user_id AS userId,
          qh.concert_id AS concertId,
          qh.queued_at AS joinedAt,
          qh.priority_level,
          u.pass_status AS passStatus
        FROM queue_history qh
        LEFT JOIN users u ON u.user_id = qh.user_id
        WHERE qh.concert_id = ?
          AND qh.status = 'queued'
          AND qh.in_line_status = 'in_line'
          AND (${fallbackWhere})
        ORDER BY COALESCE(qh.priority_level, 0) DESC, qh.queued_at ASC, qh.history_id ASC
        LIMIT 1
        `,
        [concertID]
      );
      served = Array.isArray(fallbackRows) && fallbackRows[0] ? fallbackRows[0] : null;
    }

    if (!served) {
      // Should be extremely rare (race conditions), but handle gracefully.
      sendJson(res, 200, {
        success: true,
        message: 'Queue is empty; no one to serve.',
        served: null,
        queue: [],
      });
      return;
    }

    const queuedAtMs = new Date(served.joinedAt).getTime();
    const waitSeconds = Number.isFinite(queuedAtMs)
      ? Math.max(0, Math.round((Date.now() - queuedAtMs) / 1000))
      : 0;

    await pool.promise().query(
      `
      UPDATE queue_history
      SET status = 'completed',
          in_line_status = 'entered',
          wait_time = COALESCE(wait_time, 0) + ?
      WHERE history_id = ?
      `,
      [waitSeconds, served.queueEntryId]
    );

    const [remainingRows] = await pool.promise().query(
      `
      SELECT
        qh.history_id,
        qh.concert_id AS concertId,
        qh.queued_at AS joinedAt,
        qh.user_id AS userId,
        qh.priority_level,
        u.pass_status AS passStatus,
        c.concert_name AS concertName
      FROM queue_history qh
      LEFT JOIN users u ON u.user_id = qh.user_id
      LEFT JOIN concerts c ON c.concert_id = qh.concert_id
      WHERE qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
      `
    );

    const completedByConcert = await fetchCompletedPurchaseCountsGrouped();
    const queue = buildFairOrderedActiveQueueResponse(remainingRows, completedByConcert);

    sendJson(res, 200, {
      success: true,
      message: 'Next user served and removed from queue.',
      served: {
        queueEntryId: toNumber(served.queueEntryId),
        label: `User #${toNumber(served.userId)} - Concert #${toNumber(served.concertId)}`,
        joinedAt: served.joinedAt,
        priorityLevel:
          toNumber(served.priority_level) > 0 ? passStatusToLabel(served.passStatus) : null,
      },
      queue,
      remainingCount: queue.length,
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

async function getQueueStatusByConcert(req, res, rawConcertId, userIdQuery) {
  try {
    const concertID = Number(rawConcertId);
    if (!Number.isInteger(concertID) || concertID <= 0) {
      sendJson(res, 400, { success: false, message: 'concertId must be a positive integer' });
      return;
    }

    const [concertRows] = await pool.promise().query(
      `
      SELECT concert_id, concert_name, artist_name, event_date, venue
      FROM concerts
      WHERE concert_id = ?
      LIMIT 1
      `,
      [concertID]
    );

    if (concertRows.length === 0) {
      sendJson(res, 404, { success: false, message: 'Concert not found' });
      return;
    }

    await expireStaleQueueEntries({ concertID });

    const queuedRows = await fetchQueuedRowsForConcertFair(concertID);
    const completedCount = await getCompletedPurchaseCountForConcert(concertID);
    const orderedFair = buildFairQueueOrder(queuedRows, completedCount);

    const totalInQueue = orderedFair.length;
    const userID = Number(userIdQuery);
    const userRowIndex = Number.isInteger(userID)
      ? orderedFair.findIndex((h) => toNumber(h.userId) === userID)
      : -1;

    const defaultPosition = totalInQueue > 0 ? totalInQueue + 1 : 1;
    const position = userRowIndex >= 0 ? userRowIndex + 1 : defaultPosition;
    const peopleAhead = userRowIndex >= 0 ? Math.max(0, position - 1) : 0;
    const estimatedRemainingWaitMinutes = peopleAhead * 5;

    const userQueueRow = userRowIndex >= 0 ? orderedFair[userRowIndex] : null;
    const joinedMs = userQueueRow?.joinedAt ? new Date(userQueueRow.joinedAt).getTime() : NaN;
    const elapsedFromJoinedMinutes = Number.isFinite(joinedMs)
      ? Math.max(0, Math.floor((Date.now() - joinedMs) / 60000))
      : 0;
    const accumulatedMinutes = Math.max(0, Math.floor(toNumber(userQueueRow?.waitTimeSeconds) / 60));
    const elapsedWaitMinutes = userRowIndex >= 0 ? elapsedFromJoinedMinutes + accumulatedMinutes : 0;

    const canProceedToSeatSelection = userRowIndex >= 0 && position <= 5;
    const estimatedWaitTime = canProceedToSeatSelection
      ? `0 minutes remaining - You can proceed now (waited ${elapsedWaitMinutes} min)`
      : userRowIndex >= 0
        ? `${estimatedRemainingWaitMinutes} minutes remaining (waited ${elapsedWaitMinutes} min)`
        : '0 minutes';

    if (canProceedToSeatSelection && Number.isInteger(userID) && userID > 0) {
      const msg = `You can now purchase a ticket for ${concertRows[0]?.concert_name || 'this concert'}. Grab it while it lasts.`;
      await maybeInsertNotification({ userID, message: msg });
    }

    const concert = concertRows[0];
    sendJson(res, 200, {
      success: true,
      data: {
        concertId: concertID,
        concertName: concert.concert_name,
        artist: concert.artist_name,
        date: concert.event_date,
        venue: concert.venue,
        totalInQueue,
        position,
        estimatedWaitTime,
        elapsedWaitMinutes,
        estimatedRemainingWaitMinutes,
        isInQueue: userRowIndex >= 0,
        canProceedToSeatSelection,
        isNextInLine: userRowIndex >= 0 && position === 6,
        priorityLevel:
          userRowIndex >= 0 && toNumber(orderedFair[userRowIndex]?.priority_level) > 0
            ? passStatusToLabel(orderedFair[userRowIndex]?.passStatus)
            : null,
      },
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

async function joinQueue(req, res) {
  try {
    const payload = await readJsonBody(req);
    const concertID = Number(payload.concertId);
    const userID = Number(payload.userId);

    if (!Number.isInteger(concertID) || concertID <= 0 || !Number.isInteger(userID) || userID <= 0) {
      sendJson(res, 400, { success: false, message: 'Valid concertId and userId are required' });
      return;
    }

    const [[concertRows], [userRows]] = await Promise.all([
      pool.promise().query('SELECT concert_id, concert_name FROM concerts WHERE concert_id = ? LIMIT 1', [concertID]),
      pool.promise().query('SELECT user_id, pass_status FROM users WHERE user_id = ? LIMIT 1', [userID]),
    ]);

    if (concertRows.length === 0 || userRows.length === 0) {
      sendJson(res, 400, { success: false, message: 'Invalid concertId or userId' });
      return;
    }

    const expiredEntries = await expireStaleQueueEntries({ userID });

    const [activeQueueEntries] = await pool.promise().query(
      `
      SELECT history_id, concert_id
      FROM queue_history
      WHERE user_id = ?
        AND status = 'queued'
        AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      `,
      [userID]
    );

    if (activeQueueEntries.length > 0 && toNumber(activeQueueEntries[0].concert_id) !== concertID) {
      sendJson(res, 409, {
        success: false,
        message: 'User is already in an active queue for another concert',
        activeConcertId: toNumber(activeQueueEntries[0].concert_id),
      });
      return;
    }

    if (activeQueueEntries.length > 0) {
      sendJson(res, 200, { success: true, message: 'User is already in queue' });
      return;
    }

    const priorityLevel = await fetchEffectiveUserPriority(userID, concertID);
    const passStatusLabel = priorityLevel > 0 ? passStatusToLabel(userRows[0]?.pass_status) : null;

    let insertResult;
    try {
      [insertResult] = await pool.promise().query(
        `
        INSERT INTO queue_history (
          user_id, concert_id, priority_level, ticket_count, total_cost, wait_time, status, in_line_status, queued_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 'in_line', NOW())
        `,
        [userID, concertID, priorityLevel, 1, 0, 0]
      );
    } catch (dbError) {
      // MySQL error 1062 = duplicate key (UNIQUE constraint violation)
      if (dbError?.code === 'ER_DUP_ENTRY' || (dbError?.errno === 1062)) {
        sendJson(res, 409, {
          success: false,
          message: 'User is already in queue for this concert',
          code: 'ALREADY_QUEUED',
        });
        return;
      }
      throw dbError;
    }

    const newHistoryID = toNumber(insertResult.insertId);

    const queuedRows = await fetchQueuedRowsForConcertFair(concertID);
    const completedCount = await getCompletedPurchaseCountForConcert(concertID);
    const orderedFair = buildFairQueueOrder(queuedRows, completedCount);

    const position = orderedFair.findIndex((h) => toNumber(h.history_id) === newHistoryID) + 1;
    const peopleAhead = Math.max(0, position - 1);
    const estimatedWaitMinutes = peopleAhead * 5;

    const canProceedToSeatSelection = position > 0 && position <= 5;
    const estimatedWaitTime = canProceedToSeatSelection
      ? '0 minutes'
      : `${estimatedWaitMinutes} minutes`;

    if (canProceedToSeatSelection) {
      const concertName = concertRows[0]?.concert_name || 'this concert';
      const msg = `You can now purchase a ticket for ${concertName}. Grab it while it lasts.`;
      await maybeInsertNotification({ userID, message: msg });
    }

    sendJson(res, 201, {
      success: true,
      message: expiredEntries > 0 ? 'Previous queue session expired. User rejoined queue.' : 'Joined queue',
      entry: {
        historyID: newHistoryID,
        concertID,
        userID,
        position,
        estimatedWaitTime,
        canProceedToSeatSelection,
        priorityLevel: passStatusLabel,
      },
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Bad request' });
  }
}

async function leaveQueue(req, res) {
  try {
    const payload = await readJsonBody(req);
    const concertID = Number(payload.concertId);
    const userID = Number(payload.userId);

    if (!Number.isInteger(concertID) || concertID <= 0 || !Number.isInteger(userID) || userID <= 0) {
      sendJson(res, 400, { success: false, message: 'Valid concertId and userId are required' });
      return;
    }

    await expireStaleQueueEntries({ concertID, userID });

    const [activeRows] = await pool.promise().query(
      `
      SELECT history_id, user_id, concert_id
      FROM queue_history
      WHERE concert_id = ?
        AND user_id = ?
        AND status = 'queued'
        AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      LIMIT 1
      `,
      [concertID, userID]
    );

    if (activeRows.length === 0) {
      sendJson(res, 404, { success: false, message: 'No active queue entry found for this user/concert' });
      return;
    }

    const entryToLeave = activeRows[0];

    const [[concertNameRow]] = await pool.promise().query(
      `SELECT concert_name FROM concerts WHERE concert_id = ? LIMIT 1`,
      [concertID]
    );
    const concertNameLeave = concertNameRow?.concert_name || 'this concert';

    await pool.promise().query(
      `
      UPDATE queue_history
      SET status = 'cancelled', in_line_status = 'left'
      WHERE history_id = ?
      `,
      [entryToLeave.history_id]
    );

    await maybeInsertNotification({
      userID,
      message: `You have left the queue for ${concertNameLeave}.`,
    });

    // Check if someone is now in 6th position (next in line) and send them a notification
    const queuedRowsAfterLeave = await fetchQueuedRowsForConcertFair(concertID);
    const completedCountAfterLeave = await getCompletedPurchaseCountForConcert(concertID);
    const orderedFairAfterLeave = buildFairQueueOrder(queuedRowsAfterLeave, completedCountAfterLeave);
    const sixth = orderedFairAfterLeave.length >= 6 ? orderedFairAfterLeave[5] : null;

    if (sixth) {
      const sixthPositionUserID = toNumber(sixth.userId);
      const concertName = sixth.concertName || 'the concert';
      const notificationMessage = `You're coming up next! You're currently 6th in line for ${concertName}.`;

      await pool.promise().query(
        `
        INSERT INTO notifications (user_id, message, status)
        VALUES (?, ?, 'sent')
        `,
        [sixthPositionUserID, notificationMessage]
      );
    }

    sendJson(res, 200, {
      success: true,
      message: 'Left queue successfully',
      entry: {
        historyID: toNumber(entryToLeave.history_id),
        userID: toNumber(entryToLeave.user_id),
        concertID: toNumber(entryToLeave.concert_id),
        status: 'cancelled',
        inLineStatus: 'left',
      },
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Bad request' });
  }
}

async function completePayment(req, res) {
  try {
    const payload = await readJsonBody(req);
    const concertID = Number(payload.concertId);
    const userID = Number(payload.userId);
    const ticketCount = Number(payload.ticketCount);
    const totalCost = Number(payload.totalCost);

    if (!Number.isInteger(concertID) || concertID <= 0 || !Number.isInteger(userID) || userID <= 0) {
      sendJson(res, 400, { success: false, message: 'Valid concertId and userId are required' });
      return;
    }

    if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
      sendJson(res, 400, { success: false, message: 'ticketCount must be a positive integer' });
      return;
    }

    if (!Number.isFinite(totalCost) || totalCost < 0) {
      sendJson(res, 400, { success: false, message: 'totalCost must be a non-negative number' });
      return;
    }

    await expireStaleQueueEntries({ concertID, userID });

    const [activeRows] = await pool.promise().query(
      `
      SELECT history_id, user_id, concert_id, queued_at, wait_time
      FROM queue_history
      WHERE concert_id = ?
        AND user_id = ?
        AND status = 'queued'
        AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      LIMIT 1
      `,
      [concertID, userID]
    );

    let history;
    const roundedCost = Number(totalCost.toFixed(2));
    const seatJson = normalizeSeatsForStorage(payload.seats);
    const hasSeatCol = await seatSelectionColumnExists();

    if (activeRows.length > 0) {
      const row = activeRows[0];
      const queuedAtMs = new Date(row.queued_at).getTime();
      const waitSeconds = Number.isFinite(queuedAtMs)
        ? Math.max(0, Math.round((Date.now() - queuedAtMs) / 1000))
        : toNumber(row.wait_time);

      if (hasSeatCol && seatJson) {
        await pool.promise().query(
          `
          UPDATE queue_history
          SET status = 'completed',
              in_line_status = 'entered',
              ticket_count = ?,
              total_cost = ?,
              wait_time = ?,
              seat_selection = ?
          WHERE history_id = ?
          `,
          [ticketCount, roundedCost, waitSeconds, seatJson, row.history_id]
        );
      } else {
        await pool.promise().query(
          `
          UPDATE queue_history
          SET status = 'completed',
              in_line_status = 'entered',
              ticket_count = ?,
              total_cost = ?,
              wait_time = ?
          WHERE history_id = ?
          `,
          [ticketCount, roundedCost, waitSeconds, row.history_id]
        );
      }

      history = {
        historyID: toNumber(row.history_id),
        userID,
        concertID,
        status: 'completed',
        inLineStatus: 'entered',
        ticketCount,
        totalCost: roundedCost,
      };
    } else {
      let insertId;
      if (hasSeatCol && seatJson) {
        const [insertResult] = await pool.promise().query(
          `
          INSERT INTO queue_history (
            user_id, concert_id, ticket_count, total_cost, wait_time, status, in_line_status, queued_at, seat_selection
          ) VALUES (?, ?, ?, ?, ?, 'completed', 'entered', NOW(), ?)
          `,
          [userID, concertID, ticketCount, roundedCost, 0, seatJson]
        );
        insertId = insertResult.insertId;
      } else {
        const [insertResult] = await pool.promise().query(
          `
          INSERT INTO queue_history (
            user_id, concert_id, ticket_count, total_cost, wait_time, status, in_line_status, queued_at
          ) VALUES (?, ?, ?, ?, ?, 'completed', 'entered', NOW())
          `,
          [userID, concertID, ticketCount, roundedCost, 0]
        );
        insertId = insertResult.insertId;
      }

      history = {
        historyID: toNumber(insertId),
        userID,
        concertID,
        status: 'completed',
        inLineStatus: 'entered',
        ticketCount,
        totalCost: roundedCost,
      };
    }

    await pool.promise().query(
      `
      UPDATE users
      SET total_spent = COALESCE(total_spent, 0) + ?
      WHERE user_id = ?
      `,
      [roundedCost, userID]
    );

    sendJson(res, 200, {
      success: true,
      message: 'Payment completed and ticket status updated',
      history,
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Bad request' });
  }
}

async function getNotifications(req, res) {
  try {
    const payload = await readJsonBody(req);
    const userID = Number(payload.userId);

    if (!Number.isInteger(userID) || userID <= 0) {
      sendJson(res, 400, { success: false, message: 'Valid userId is required' });
      return;
    }

    const [notifications] = await pool.promise().query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY notification_id DESC
      `,
      [userID]
    );

    sendJson(res, 200, {
      success: true,
      count: notifications.length,
      notifications: notifications.map((notif) => ({
        notificationId: toNumber(notif.notification_id),
        userId: toNumber(notif.user_id),
        message: notif.message,
        timestamp: notif.timestamp ?? notif.created_at ?? null,
        status: notif.status,
      })),
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

async function markNotificationAsViewed(req, res) {
  try {
    const payload = await readJsonBody(req);
    const notificationID = Number(payload.notificationId);

    if (!Number.isInteger(notificationID) || notificationID <= 0) {
      sendJson(res, 400, { success: false, message: 'Valid notificationId is required' });
      return;
    }

    await pool.promise().query(
      `
      UPDATE notifications
      SET status = 'viewed'
      WHERE notification_id = ?
      `,
      [notificationID]
    );

    sendJson(res, 200, {
      success: true,
      message: 'Notification marked as viewed',
      notificationId: notificationID,
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Bad request' });
  }
}

async function reorderQueueEntry(req, res) {
  try {
    const payload = await readJsonBody(req);
    const historyID = Number(payload.historyId);
    const direction = String(payload.direction || '').toLowerCase();
    const hasTarget = Number.isInteger(Number(payload.targetPosition));
    const targetPosition = hasTarget ? Number(payload.targetPosition) : null;

    if (!Number.isInteger(historyID) || historyID <= 0) {
      sendJson(res, 400, { success: false, message: 'historyId must be a positive integer' });
      return;
    }

    if (!['up', 'down'].includes(direction) && targetPosition === null) {
      sendJson(res, 400, {
        success: false,
        message: 'Provide direction (up/down) or targetPosition',
      });
      return;
    }

    const [entryRows] = await pool.promise().query(
      `
      SELECT history_id, concert_id
      FROM queue_history
      WHERE history_id = ?
        AND status = 'queued'
        AND in_line_status = 'in_line'
      LIMIT 1
      `,
      [historyID]
    );

    if (!Array.isArray(entryRows) || entryRows.length === 0) {
      sendJson(res, 404, { success: false, message: 'Active queue entry not found' });
      return;
    }

    const concertID = toNumber(entryRows[0].concert_id);
    const queuedRows = await fetchQueuedRowsForConcertFair(concertID);
    // Admin override mode: move users by exact visible queue order.
    const fairOrdered = sortQueueRowsFifo(queuedRows);

    const currentIndex = fairOrdered.findIndex((r) => toNumber(r.history_id) === historyID);
    if (currentIndex < 0) {
      sendJson(res, 404, { success: false, message: 'Queue entry not found in active order' });
      return;
    }

    let nextIndex = currentIndex;
    if (targetPosition !== null) {
      nextIndex = Math.max(0, Math.min(fairOrdered.length - 1, targetPosition - 1));
    } else if (direction === 'up') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (direction === 'down') {
      nextIndex = Math.min(fairOrdered.length - 1, currentIndex + 1);
    }

    if (nextIndex === currentIndex) {
      sendJson(res, 200, {
        success: true,
        message: 'Entry already at requested position',
        previousPosition: currentIndex + 1,
        newPosition: nextIndex + 1,
      });
      return;
    }

    const reordered = [...fairOrdered];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    const conn = await pool.promise().getConnection();
    try {
      await conn.beginTransaction();
      const baseMs = Date.now() - reordered.length * 1000;
      for (let i = 0; i < reordered.length; i += 1) {
        const ts = new Date(baseMs + i * 1000);
        await conn.query(
          `
          UPDATE queue_history
          SET wait_time = COALESCE(wait_time, 0) + GREATEST(TIMESTAMPDIFF(SECOND, queued_at, NOW()), 0),
              queued_at = ?
          WHERE history_id = ?
            AND status = 'queued'
            AND in_line_status = 'in_line'
          `,
          [ts, toNumber(reordered[i].history_id)]
        );
      }
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // Recompute after persistence so API returns the position users will actually see.
    const refreshedQueuedRows = await fetchQueuedRowsForConcertFair(concertID);
    const refreshedFair = sortQueueRowsFifo(refreshedQueuedRows);
    const appliedIndex = refreshedFair.findIndex((r) => toNumber(r.history_id) === historyID);
    const appliedPosition = appliedIndex >= 0 ? appliedIndex + 1 : null;
    const requestedPosition = targetPosition ?? nextIndex + 1;

    sendJson(res, 200, {
      success: true,
      message:
        appliedPosition != null && requestedPosition !== appliedPosition
          ? `Queue reordered. Requested #${requestedPosition}, applied #${appliedPosition}.`
          : 'Queue entry reordered successfully',
      previousPosition: currentIndex + 1,
      requestedPosition,
      newPosition: appliedPosition ?? (nextIndex + 1),
      concertID,
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Bad request' });
  }
}

async function removeFromQueue(req, res, rawHistoryId) {
  try {
    const historyID = Number(rawHistoryId);
    if (!Number.isInteger(historyID) || historyID <= 0) {
      sendJson(res, 400, { success: false, message: 'historyId must be a positive integer' });
      return;
    }

    const [rows] = await pool.promise().query(
      `SELECT history_id, user_id, concert_id
       FROM queue_history
       WHERE history_id = ?
         AND status = 'queued'
         AND in_line_status = 'in_line'
       LIMIT 1`,
      [historyID]
    );

    if (rows.length === 0) {
      sendJson(res, 404, { success: false, message: 'No active queue entry found for this id' });
      return;
    }

    const entry = rows[0];
    const userID = toNumber(entry.user_id);
    const concertID = toNumber(entry.concert_id);

    // Remove ALL active entries for this user in this concert (handles duplicates/bots)
    const [result] = await pool.promise().query(
      `UPDATE queue_history
       SET status = 'cancelled', in_line_status = 'left'
       WHERE user_id = ?
         AND concert_id = ?
         AND status = 'queued'
         AND in_line_status = 'in_line'`,
      [userID, concertID]
    );

    sendJson(res, 200, {
      success: true,
      message: `User removed from queue by admin (${result.affectedRows} entr${result.affectedRows === 1 ? 'y' : 'ies'} cleared).`,
      entry: {
        historyID: toNumber(entry.history_id),
        userID,
        concertID,
        removedCount: result.affectedRows,
      },
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

module.exports = {
  getQueue,
  getQueueStatusByConcert,
  serveNext,
  joinQueue,
  leaveQueue,
  completePayment,
  removeFromQueue,
  reorderQueueEntry,
  getNotifications,
  markNotificationAsViewed,
};
