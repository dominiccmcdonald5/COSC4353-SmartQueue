const { pool } = require('../database');

const PRIORITY = {
  NONE: 0,
  PASS: 1,
};

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

function passStatusToLabel(passStatus) {
  const s = String(passStatus || 'None');
  if (s === 'Gold') return 'gold';
  if (s === 'Silver') return 'silver';
  return null;
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
  const [rows] = await pool.promise().query(
    `
    SELECT
      qh.history_id,
      qh.user_id AS userId,
      qh.queued_at AS joinedAt,
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
    const [rows] = await pool.promise().query(
      `
      SELECT
        qh.history_id,
        qh.concert_id AS concertId,
        qh.queued_at AS joinedAt,
        qh.user_id AS userId,
        qh.priority_level,
        u.pass_status AS passStatus,
        u.first_name AS firstName,
        u.last_name AS lastName,
        c.concert_name AS concertName
      FROM queue_history qh
      LEFT JOIN users u ON u.user_id = qh.user_id
      LEFT JOIN concerts c ON c.concert_id = qh.concert_id
      WHERE qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
      `
    );

    const completedByConcert = await fetchCompletedPurchaseCountsGrouped();
    const queue = buildFairOrderedActiveQueueResponse(rows, completedByConcert);

    sendJson(res, 200, {
      success: true,
      count: queue.length,
      queue,
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

async function serveNext(req, res) {
  try {
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
      SET status = 'completed', in_line_status = 'entered', wait_time = ?
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
    const estimatedWaitMinutes = peopleAhead * 5;

    const canProceedToSeatSelection = userRowIndex >= 0 && position <= 5;
    const estimatedWaitTime = canProceedToSeatSelection
      ? '0 minutes — You can proceed to seat selection now'
      : userRowIndex >= 0
        ? `${estimatedWaitMinutes} minutes`
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

    const [insertResult] = await pool.promise().query(
      `
      INSERT INTO queue_history (
        user_id, concert_id, priority_level, ticket_count, total_cost, wait_time, status, in_line_status, queued_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 'in_line', NOW())
      `,
      [userID, concertID, priorityLevel, 1, 0, 0]
    );

    const newHistoryID = toNumber(insertResult.insertId);

    const queuedRows = await fetchQueuedRowsForConcertFair(concertID);
    const completedCount = await getCompletedPurchaseCountForConcert(concertID);
    const orderedFair = buildFairQueueOrder(queuedRows, completedCount);

    const position = orderedFair.findIndex((h) => toNumber(h.history_id) === newHistoryID) + 1;
    const peopleAhead = Math.max(0, position - 1);
    const estimatedWaitMinutes = peopleAhead * 5;

    const canProceedToSeatSelection = position > 0 && position <= 5;
    const estimatedWaitTime = canProceedToSeatSelection
      ? '0 minutes — You can proceed to seat selection now'
      : `${estimatedWaitMinutes} minutes`;

    if (canProceedToSeatSelection) {
      const concertName = concertRows[0]?.concert_name || 'this concert';
      const msg = `You can now purchase a ticket for ${concertName}. Grab it while it lasts.`;
      await maybeInsertNotification({ userID, message: msg });
    }

    sendJson(res, 201, {
      success: true,
      message: 'Joined queue',
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

    await pool.promise().query(
      `
      UPDATE queue_history
      SET status = 'cancelled', in_line_status = 'left'
      WHERE history_id = ?
      `,
      [entryToLeave.history_id]
    );

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

    if (activeRows.length > 0) {
      const row = activeRows[0];
      const queuedAtMs = new Date(row.queued_at).getTime();
      const waitSeconds = Number.isFinite(queuedAtMs)
        ? Math.max(0, Math.round((Date.now() - queuedAtMs) / 1000))
        : toNumber(row.wait_time);

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
      const [insertResult] = await pool.promise().query(
        `
        INSERT INTO queue_history (
          user_id, concert_id, ticket_count, total_cost, wait_time, status, in_line_status, queued_at
        ) VALUES (?, ?, ?, ?, ?, 'completed', 'entered', NOW())
        `,
        [userID, concertID, ticketCount, roundedCost, 0]
      );

      history = {
        historyID: toNumber(insertResult.insertId),
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

module.exports = {
  getQueue,
  getQueueStatusByConcert,
  serveNext,
  joinQueue,
  leaveQueue,
  completePayment,
  getNotifications,
  markNotificationAsViewed,
};
