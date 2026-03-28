/**
 * In-memory service queue for admin: view waiting users and serve next.
 * Replace with DB + auth later; good enough for assignment demos.
 */

const { allMockData, persistMockData } = require('../mockData');

let queueIdSeq = 4;

/** @type {Array<{ queueEntryId: number, label: string, joinedAt: string, priorityLevel?: string }>} */
let entries = [
  {
    queueEntryId: 1,
    label: 'User #1001 — General Support',
    joinedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    priorityLevel: 'medium',
  },
  {
    queueEntryId: 2,
    label: 'User #1002 — Ticket Issue',
    joinedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    priorityLevel: 'high',
  },
  {
    queueEntryId: 3,
    label: 'User #1003 — General Support',
    joinedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    priorityLevel: 'low',
  },
];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function getQueue(req, res) {
  sendJson(res, 200, {
    success: true,
    count: entries.length,
    queue: entries.map((e, index) => ({
      position: index + 1,
      queueEntryId: e.queueEntryId,
      label: e.label,
      joinedAt: e.joinedAt,
      priorityLevel: e.priorityLevel || null,
    })),
  });
}

function serveNext(req, res) {
  if (entries.length === 0) {
    sendJson(res, 200, {
      success: true,
      message: 'Queue is empty; no one to serve.',
      served: null,
      queue: [],
    });
    return;
  }

  const [served, ...rest] = entries;
  entries = rest;

  sendJson(res, 200, {
    success: true,
    message: 'Next user served and removed from queue.',
    served: {
      queueEntryId: served.queueEntryId,
      label: served.label,
      joinedAt: served.joinedAt,
      priorityLevel: served.priorityLevel || null,
    },
    queue: entries.map((e, index) => ({
      position: index + 1,
      queueEntryId: e.queueEntryId,
      label: e.label,
      joinedAt: e.joinedAt,
      priorityLevel: e.priorityLevel || null,
    })),
    remainingCount: entries.length,
  });
}

function getQueueStatusByConcert(req, res, rawConcertId, userIdQuery) {
  const concertID = Number(rawConcertId);
  if (!Number.isInteger(concertID) || concertID <= 0) {
    sendJson(res, 400, { success: false, message: 'concertId must be a positive integer' });
    return;
  }

  const concert = allMockData.CONCERT.find((c) => c.concertID === concertID);
  if (!concert) {
    sendJson(res, 404, { success: false, message: 'Concert not found' });
    return;
  }

  const queuedRows = allMockData.HISTORY
    .filter(
      (h) =>
        h.concertID === concertID &&
        String(h.status).toLowerCase() === 'queued' &&
        String(h.inLineStatus || '').toLowerCase() !== 'left' &&
        String(h.inLineStatus || '').toLowerCase() !== 'entered',
    )
    .sort((a, b) => {
      const timeDiff = new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return Number(a.historyID) - Number(b.historyID);
    });

  const totalInQueue = queuedRows.length;
  const userID = Number(userIdQuery);
  const userRowIndex = Number.isInteger(userID)
    ? queuedRows.findIndex((h) => h.userID === userID)
    : -1;

  const defaultPosition = totalInQueue > 0 ? totalInQueue + 1 : 1;
  const position = userRowIndex >= 0 ? userRowIndex + 1 : defaultPosition;

  const peopleAhead = Math.max(0, position - 1);
  const estimatedWaitMinutes = peopleAhead * 5;

  sendJson(res, 200, {
    success: true,
    data: {
      concertId: concertID,
      concertName: concert.concertName,
      artist: concert.artistName,
      date: concert.date,
      venue: concert.venue,
      totalInQueue,
      position,
      estimatedWaitTime: `${estimatedWaitMinutes} minutes`,
      isInQueue: userRowIndex >= 0,
    },
  });
}

/** Optional: simulate a user joining (for tests / future user UI) */
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
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', () => reject(new Error('read error')));
  });
}

async function joinQueue(req, res) {
  try {
    const payload = await readJsonBody(req);
    const concertID = Number(payload.concertId);
    const userID = Number(payload.userId);

    // New behavior for concert queue: insert into HISTORY so queue count is query-based.
    if (Number.isInteger(concertID) && concertID > 0 && Number.isInteger(userID) && userID > 0) {
      const concertExists = allMockData.CONCERT.some((c) => c.concertID === concertID);
      const userExists = allMockData.USER.some((u) => u.userID === userID);
      if (!concertExists || !userExists) {
        sendJson(res, 400, { success: false, message: 'Invalid concertId or userId' });
        return;
      }

      const activeQueueEntries = allMockData.HISTORY
        .filter(
          (h) =>
            h.userID === userID &&
            String(h.status).toLowerCase() === 'queued' &&
            String(h.inLineStatus || '').toLowerCase() === 'in_line',
        )
        .sort((a, b) => {
          const timeDiff = new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
          if (timeDiff !== 0) return timeDiff;
          return Number(a.historyID) - Number(b.historyID);
        });

      if (activeQueueEntries.length > 0 && activeQueueEntries[0].concertID !== concertID) {
        sendJson(res, 409, {
          success: false,
          message: 'User is already in an active queue for another concert',
          activeConcertId: activeQueueEntries[0].concertID,
        });
        return;
      }

      const alreadyQueued = allMockData.HISTORY.some(
        (h) =>
          h.concertID === concertID &&
          h.userID === userID &&
          String(h.status).toLowerCase() === 'queued' &&
          String(h.inLineStatus || '').toLowerCase() === 'in_line',
      );
      if (alreadyQueued) {
        sendJson(res, 200, { success: true, message: 'User is already in queue' });
        return;
      }

      const nextHistoryID = allMockData.HISTORY.reduce((max, row) => Math.max(max, Number(row.historyID) || 0), 0) + 1;
      const entry = {
        historyID: nextHistoryID,
        userID,
        concertID,
        ticketCount: 1,
        totalCost: 0,
        waitTime: 0,
        status: 'queued',
        inLineStatus: 'in_line',
        queuedAt: new Date().toISOString(),
      };
      allMockData.HISTORY.push(entry);
      persistMockData(allMockData);

      const queueForConcert = allMockData.HISTORY
        .filter(
          (h) =>
            h.concertID === concertID &&
            String(h.status).toLowerCase() === 'queued' &&
            String(h.inLineStatus || '').toLowerCase() === 'in_line',
        )
        .sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
      const position = queueForConcert.findIndex((h) => h.historyID === nextHistoryID) + 1;

      sendJson(res, 201, {
        success: true,
        message: 'Joined queue',
        entry: {
          historyID: entry.historyID,
          concertID,
          userID,
          position,
          estimatedWaitTime: `${Math.max(0, (position - 1) * 5)} minutes`,
        },
      });
      return;
    }

    // Legacy admin support queue behavior
    const label =
      typeof payload.label === 'string' && payload.label.trim()
        ? payload.label.trim().slice(0, 200)
        : `Guest ${queueIdSeq}`;
    const priorityLevel =
      typeof payload.priorityLevel === 'string' &&
      ['low', 'medium', 'high'].includes(payload.priorityLevel.toLowerCase())
        ? payload.priorityLevel.toLowerCase()
        : 'medium';

    const row = {
      queueEntryId: queueIdSeq++,
      label,
      joinedAt: new Date().toISOString(),
      priorityLevel,
    };
    entries.push(row);

    sendJson(res, 201, {
      success: true,
      message: 'Joined queue',
      entry: {
        position: entries.length,
        queueEntryId: row.queueEntryId,
        label: row.label,
        joinedAt: row.joinedAt,
        priorityLevel: row.priorityLevel,
      },
    });
  } catch (e) {
    sendJson(res, 400, { success: false, message: e.message || 'Bad request' });
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

    const activeRows = allMockData.HISTORY
      .filter(
        (h) =>
          h.concertID === concertID &&
          h.userID === userID &&
          String(h.status).toLowerCase() === 'queued' &&
          String(h.inLineStatus || '').toLowerCase() === 'in_line',
      )
      .sort((a, b) => {
        const timeDiff = new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return Number(a.historyID) - Number(b.historyID);
      });

    if (activeRows.length === 0) {
      sendJson(res, 404, { success: false, message: 'No active queue entry found for this user/concert' });
      return;
    }

    const entryToLeave = activeRows[0];
    entryToLeave.status = 'cancelled';
    entryToLeave.inLineStatus = 'left';
    persistMockData(allMockData);

    sendJson(res, 200, {
      success: true,
      message: 'Left queue successfully',
      entry: {
        historyID: entryToLeave.historyID,
        userID: entryToLeave.userID,
        concertID: entryToLeave.concertID,
        status: entryToLeave.status,
        inLineStatus: entryToLeave.inLineStatus,
      },
    });
  } catch (e) {
    sendJson(res, 400, { success: false, message: e.message || 'Bad request' });
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

    const activeRows = allMockData.HISTORY
      .filter(
        (h) =>
          h.concertID === concertID &&
          h.userID === userID &&
          String(h.status).toLowerCase() === 'queued' &&
          String(h.inLineStatus || '').toLowerCase() === 'in_line',
      )
      .sort((a, b) => {
        const timeDiff = new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return Number(a.historyID) - Number(b.historyID);
      });

    let row;
    if (activeRows.length > 0) {
      row = activeRows[0];
      const queuedAtMs = new Date(row.queuedAt).getTime();
      const waitSeconds = Number.isFinite(queuedAtMs)
        ? Math.max(0, Math.round((Date.now() - queuedAtMs) / 1000))
        : Number(row.waitTime) || 0;

      row.status = 'completed';
      row.inLineStatus = 'entered';
      row.ticketCount = ticketCount;
      row.totalCost = Number(totalCost.toFixed(2));
      row.waitTime = waitSeconds;
    } else {
      const nextHistoryID = allMockData.HISTORY.reduce((max, r) => Math.max(max, Number(r.historyID) || 0), 0) + 1;
      row = {
        historyID: nextHistoryID,
        userID,
        concertID,
        ticketCount,
        totalCost: Number(totalCost.toFixed(2)),
        waitTime: 0,
        status: 'completed',
        inLineStatus: 'entered',
        queuedAt: new Date().toISOString(),
      };
      allMockData.HISTORY.push(row);
    }

    persistMockData(allMockData);

    sendJson(res, 200, {
      success: true,
      message: 'Payment completed and ticket status updated',
      history: {
        historyID: row.historyID,
        userID: row.userID,
        concertID: row.concertID,
        status: row.status,
        inLineStatus: row.inLineStatus,
        ticketCount: row.ticketCount,
        totalCost: row.totalCost,
      },
    });
  } catch (e) {
    sendJson(res, 400, { success: false, message: e.message || 'Bad request' });
  }
}

module.exports = {
  getQueue,
  getQueueStatusByConcert,
  serveNext,
  joinQueue,
  leaveQueue,
  completePayment,
};
