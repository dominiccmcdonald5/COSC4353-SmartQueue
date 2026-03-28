const { allMockData, persistMockData } = require('../mockData');

const CONCERT_STATUSES = new Set(['open', 'sold_out']);

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

/** GET — list every concert (mock / JSON store). */
function getAllConcerts(req, res) {
  const concerts = [...allMockData.CONCERT].sort((a, b) => a.concertID - b.concertID);
  sendJson(res, 200, {
    success: true,
    count: concerts.length,
    concerts,
  });
}

const EDITABLE_FIELDS = [
  'concertName',
  'artistName',
  'genre',
  'date',
  'venue',
  'capacity',
  'ticketPrice',
  'concertImage',
  'concertStatus',
];

function validateEditPayload(payload) {
  const errors = [];
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    errors.push('At least one updatable field is required');
    return errors;
  }

  const invalid = keys.filter((k) => !EDITABLE_FIELDS.includes(k));
  if (invalid.length > 0) {
    errors.push(`Invalid field(s): ${invalid.join(', ')}`);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'concertName')) {
    if (typeof payload.concertName !== 'string' || !payload.concertName.trim()) {
      errors.push('concertName must be a non-empty string');
    } else if (payload.concertName.trim().length > 200) {
      errors.push('concertName must be at most 200 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'artistName')) {
    if (typeof payload.artistName !== 'string' || !payload.artistName.trim()) {
      errors.push('artistName must be a non-empty string');
    } else if (payload.artistName.trim().length > 120) {
      errors.push('artistName must be at most 120 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'genre')) {
    if (typeof payload.genre !== 'string' || !payload.genre.trim()) {
      errors.push('genre must be a non-empty string');
    } else if (payload.genre.trim().length > 80) {
      errors.push('genre must be at most 80 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'venue')) {
    if (typeof payload.venue !== 'string' || !payload.venue.trim()) {
      errors.push('venue must be a non-empty string');
    } else if (payload.venue.trim().length > 200) {
      errors.push('venue must be at most 200 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'date')) {
    const d = new Date(payload.date);
    if (Number.isNaN(d.getTime())) {
      errors.push('date must be a valid date (ISO string recommended)');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'capacity')) {
    if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
      errors.push('capacity must be a positive integer');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'ticketPrice')) {
    const p = Number(payload.ticketPrice);
    if (!Number.isFinite(p) || p < 0) {
      errors.push('ticketPrice must be a non-negative number');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'concertImage')) {
    if (typeof payload.concertImage !== 'string' || !payload.concertImage.trim()) {
      errors.push('concertImage must be a non-empty string');
    } else if (payload.concertImage.trim().length > 500) {
      errors.push('concertImage URL must be at most 500 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'concertStatus')) {
    const s = String(payload.concertStatus).toLowerCase();
    if (!CONCERT_STATUSES.has(s)) {
      errors.push('concertStatus must be one of: open, sold_out');
    }
  }

  return errors;
}

/** PUT — partial update by concertID; persists to mockDataStore.json. */
async function editConcert(req, res, rawId) {
  const concertID = Number(rawId);
  if (!Number.isInteger(concertID) || concertID <= 0) {
    sendJson(res, 400, { success: false, message: 'concertID must be a positive integer' });
    return;
  }

  const index = allMockData.CONCERT.findIndex((c) => c.concertID === concertID);
  if (index === -1) {
    sendJson(res, 404, { success: false, message: 'Concert not found' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload);
    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const current = allMockData.CONCERT[index];
    const updated = { ...current };

    if (Object.prototype.hasOwnProperty.call(payload, 'concertName')) {
      updated.concertName = payload.concertName.trim();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'artistName')) {
      updated.artistName = payload.artistName.trim();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'genre')) {
      updated.genre = payload.genre.trim();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'venue')) {
      updated.venue = payload.venue.trim();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'date')) {
      updated.date = new Date(payload.date).toISOString();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'capacity')) {
      updated.capacity = payload.capacity;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'ticketPrice')) {
      updated.ticketPrice = Number(Number(payload.ticketPrice).toFixed(2));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'concertImage')) {
      updated.concertImage = payload.concertImage.trim();
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'concertStatus')) {
      updated.concertStatus = String(payload.concertStatus).toLowerCase();
    }

    allMockData.CONCERT[index] = updated;
    persistMockData(allMockData);

    sendJson(res, 200, {
      success: true,
      message: 'Concert updated successfully',
      concert: updated,
    });
  } catch (error) {
    sendJson(res, 400, {
      success: false,
      message: error.message || 'Unable to update concert',
    });
  }
}

/** DELETE — remove concert and related HISTORY rows; persists store. */
function deleteConcert(req, res, rawId) {
  const concertID = Number(rawId);
  if (!Number.isInteger(concertID) || concertID <= 0) {
    sendJson(res, 400, { success: false, message: 'concertID must be a positive integer' });
    return;
  }

  const index = allMockData.CONCERT.findIndex((c) => c.concertID === concertID);
  if (index === -1) {
    sendJson(res, 404, { success: false, message: 'Concert not found' });
    return;
  }

  const [removed] = allMockData.CONCERT.splice(index, 1);
  const historyBefore = allMockData.HISTORY.length;
  allMockData.HISTORY = allMockData.HISTORY.filter((h) => h.concertID !== concertID);
  persistMockData(allMockData);

  sendJson(res, 200, {
    success: true,
    message: 'Concert deleted successfully',
    concertID,
    removedConcert: removed,
    historyEntriesRemoved: historyBefore - allMockData.HISTORY.length,
  });
}

module.exports = {
  getAllConcerts,
  editConcert,
  deleteConcert,
};
