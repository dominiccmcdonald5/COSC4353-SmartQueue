/**
 * In-memory service queue for admin: view waiting users and serve next.
 * Replace with DB + auth later; good enough for assignment demos.
 */

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

module.exports = {
  getQueue,
  serveNext,
  joinQueue,
};
