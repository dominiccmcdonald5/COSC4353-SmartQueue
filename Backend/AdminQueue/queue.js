const { pool } = require('../database');

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

async function getQueue(req, res) {
  try {
    const [rows] = await pool.promise().query(
      `
      SELECT
        qh.history_id AS queueEntryId,
        qh.queued_at AS joinedAt,
        qh.user_id AS userId,
        u.first_name AS firstName,
        u.last_name AS lastName,
        c.concert_name AS concertName
      FROM queue_history qh
      LEFT JOIN users u ON u.user_id = qh.user_id
      LEFT JOIN concerts c ON c.concert_id = qh.concert_id
      WHERE qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
      ORDER BY qh.queued_at ASC, qh.history_id ASC
      `
    );

    sendJson(res, 200, {
      success: true,
      count: rows.length,
      queue: rows.map((row, index) => ({
        position: index + 1,
        queueEntryId: toNumber(row.queueEntryId),
        label: `User #${toNumber(row.userId)} - ${row.concertName || 'Queue Entry'}`,
        joinedAt: row.joinedAt,
        priorityLevel: null,
      })),
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Database error' });
  }
}

async function serveNext(req, res) {
  try {
    const [rows] = await pool.promise().query(
      `
      SELECT history_id AS queueEntryId, user_id AS userId, concert_id AS concertId, queued_at AS joinedAt
      FROM queue_history
      WHERE status = 'queued'
        AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      LIMIT 1
      `
    );

    if (rows.length === 0) {
      sendJson(res, 200, {
        success: true,
        message: 'Queue is empty; no one to serve.',
        served: null,
        queue: [],
      });
      return;
    }

    const served = rows[0];
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
        qh.history_id AS queueEntryId,
        qh.queued_at AS joinedAt,
        qh.user_id AS userId,
        c.concert_name AS concertName
      FROM queue_history qh
      LEFT JOIN concerts c ON c.concert_id = qh.concert_id
      WHERE qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
      ORDER BY qh.queued_at ASC, qh.history_id ASC
      `
    );

    sendJson(res, 200, {
      success: true,
      message: 'Next user served and removed from queue.',
      served: {
        queueEntryId: toNumber(served.queueEntryId),
        label: `User #${toNumber(served.userId)} - Concert #${toNumber(served.concertId)}`,
        joinedAt: served.joinedAt,
        priorityLevel: null,
      },
      queue: remainingRows.map((row, index) => ({
        position: index + 1,
        queueEntryId: toNumber(row.queueEntryId),
        label: `User #${toNumber(row.userId)} - ${row.concertName || 'Queue Entry'}`,
        joinedAt: row.joinedAt,
        priorityLevel: null,
      })),
      remainingCount: remainingRows.length,
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

    const [queuedRows] = await pool.promise().query(
      `
      SELECT history_id, user_id, queued_at
      FROM queue_history
      WHERE concert_id = ?
        AND status = 'queued'
        AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      `,
      [concertID]
    );

    const totalInQueue = queuedRows.length;
    const userID = Number(userIdQuery);
    const userRowIndex = Number.isInteger(userID)
      ? queuedRows.findIndex((h) => toNumber(h.user_id) === userID)
      : -1;

    const defaultPosition = totalInQueue > 0 ? totalInQueue + 1 : 1;
    const position = userRowIndex >= 0 ? userRowIndex + 1 : defaultPosition;
    const peopleAhead = Math.max(0, position - 1);
    const estimatedWaitMinutes = peopleAhead * 5;

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
        estimatedWaitTime: `${estimatedWaitMinutes} minutes`,
        isInQueue: userRowIndex >= 0,
        isNextInLine: userRowIndex >= 0 && position === 6,
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
      pool.promise().query('SELECT concert_id FROM concerts WHERE concert_id = ? LIMIT 1', [concertID]),
      pool.promise().query('SELECT user_id FROM users WHERE user_id = ? LIMIT 1', [userID]),
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

    const [insertResult] = await pool.promise().query(
      `
      INSERT INTO queue_history (
        user_id, concert_id, ticket_count, total_cost, wait_time, status, in_line_status, queued_at
      ) VALUES (?, ?, ?, ?, ?, 'queued', 'in_line', NOW())
      `,
      [userID, concertID, 1, 0, 0]
    );

    const newHistoryID = toNumber(insertResult.insertId);

    const [queueForConcert] = await pool.promise().query(
      `
      SELECT history_id
      FROM queue_history
      WHERE concert_id = ?
        AND status = 'queued'
        AND in_line_status = 'in_line'
      ORDER BY queued_at ASC, history_id ASC
      `,
      [concertID]
    );

    const position = queueForConcert.findIndex((h) => toNumber(h.history_id) === newHistoryID) + 1;

    sendJson(res, 201, {
      success: true,
      message: 'Joined queue',
      entry: {
        historyID: newHistoryID,
        concertID,
        userID,
        position,
        estimatedWaitTime: `${Math.max(0, (position - 1) * 5)} minutes`,
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

    // Check if someone is now in 6th position and send them a notification
    const [usersSixthPosition] = await pool.promise().query(
      `
      SELECT qh.user_id, c.concert_name
      FROM queue_history qh
      LEFT JOIN concerts c ON c.concert_id = qh.concert_id
      WHERE qh.concert_id = ?
        AND qh.status = 'queued'
        AND qh.in_line_status = 'in_line'
      ORDER BY qh.queued_at ASC, qh.history_id ASC
      LIMIT 6, 1
      `,
      [concertID]
    );

    if (usersSixthPosition.length > 0) {
      const sixthPositionUserID = toNumber(usersSixthPosition[0].user_id);
      const concertName = usersSixthPosition[0].concert_name || 'the concert';
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
      SELECT notification_id, user_id, message, timestamp, status
      FROM notifications
      WHERE user_id = ?
      ORDER BY timestamp DESC
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
        timestamp: notif.timestamp,
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
