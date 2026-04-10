const {
  listConcertsForAdmin,
  getConcertById,
  insertConcert,
  updateConcert,
  deleteConcert,
} = require('../db/concertsDb');

const CONCERT_STATUSES = new Set(['open', 'sold_out']);

/**
 * HTML date inputs send YYYY-MM-DD. `new Date('YYYY-MM-DD')` is UTC midnight and can
 * shift the calendar day when written to MySQL or read back. Use local calendar date.
 */
function parseClientDateForDb(value) {
  if (value == null) return null;
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

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

async function getAllConcerts(req, res) {
  try {
    const concerts = await listConcertsForAdmin();
    sendJson(res, 200, {
      success: true,
      count: concerts.length,
      concerts,
    });
  } catch (err) {
    console.error('getAllConcerts:', err);
    sendJson(res, 500, { success: false, message: err.message || 'Failed to load concerts' });
  }
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
    } else if (payload.artistName.trim().length > 50) {
      errors.push('artistName must be at most 50 characters');
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
    if (!parseClientDateForDb(payload.date)) {
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

function apiPatchToDbColumns(payload) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'concertName')) {
    patch.concert_name = payload.concertName.trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'artistName')) {
    patch.artist_name = payload.artistName.trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'genre')) {
    patch.genre = payload.genre.trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'venue')) {
    patch.venue = payload.venue.trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'date')) {
    const dt = parseClientDateForDb(payload.date);
    if (dt) patch.event_date = dt;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'capacity')) {
    patch.capacity = payload.capacity;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'ticketPrice')) {
    patch.ticket_price = Number(Number(payload.ticketPrice).toFixed(2));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'concertImage')) {
    patch.concert_image = payload.concertImage.trim();
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'concertStatus')) {
    patch.concert_status = String(payload.concertStatus).toLowerCase();
  }
  return patch;
}

async function createConcert(req, res) {
  try {
    const payload = await readJsonBody(req);
    const errors = [];

    if (!payload.concertName || typeof payload.concertName !== 'string' || !payload.concertName.trim()) {
      errors.push('concertName is required');
    }
    if (!payload.artistName || typeof payload.artistName !== 'string' || !payload.artistName.trim()) {
      errors.push('artistName is required');
    } else if (payload.artistName.trim().length > 50) {
      errors.push('artistName must be at most 50 characters');
    }
    if (!payload.genre || typeof payload.genre !== 'string' || !payload.genre.trim()) {
      errors.push('genre is required');
    }
    if (!payload.venue || typeof payload.venue !== 'string' || !payload.venue.trim()) {
      errors.push('venue is required');
    }
    if (!parseClientDateForDb(payload.date)) {
      errors.push('date must be a valid date');
    }
    if (!Number.isInteger(Number(payload.capacity)) || Number(payload.capacity) < 1) {
      errors.push('capacity must be a positive integer');
    }
    const price = Number(payload.ticketPrice);
    if (!Number.isFinite(price) || price < 0) {
      errors.push('ticketPrice must be a non-negative number');
    }

    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const newId = await insertConcert({
      concertName: payload.concertName.trim(),
      artistName: payload.artistName.trim(),
      genre: payload.genre.trim(),
      concertDate: parseClientDateForDb(payload.date),
      venue: payload.venue.trim(),
      capacity: Number(payload.capacity),
      ticketPrice: Number(price.toFixed(2)),
      concertImage:
        typeof payload.concertImage === 'string' && payload.concertImage.trim()
          ? payload.concertImage.trim()
          : `https://picsum.photos/seed/smartqueue-concert-${Date.now()}/600/400`,
      concertStatus: 'open',
    });
    const newConcert = await getConcertById(newId);

    sendJson(res, 201, {
      success: true,
      message: 'Concert created successfully',
      concert: newConcert,
    });
  } catch (error) {
    console.error('createConcert:', error);
    sendJson(res, 400, { success: false, message: error.message || 'Unable to create concert' });
  }
}

async function editConcert(req, res, rawId) {
  const concertID = Number(rawId);
  if (!Number.isInteger(concertID) || concertID <= 0) {
    sendJson(res, 400, { success: false, message: 'concertID must be a positive integer' });
    return;
  }

  try {
    const existing = await getConcertById(concertID);
    if (!existing) {
      sendJson(res, 404, { success: false, message: 'Concert not found' });
      return;
    }

    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload);
    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const dbPatch = apiPatchToDbColumns(payload);
    await updateConcert(concertID, dbPatch);

    const updated = await getConcertById(concertID);
    sendJson(res, 200, {
      success: true,
      message: 'Concert updated successfully',
      concert: updated,
    });
  } catch (error) {
    console.error('editConcert:', error);
    sendJson(res, 400, {
      success: false,
      message: error.message || 'Unable to update concert',
    });
  }
}

async function deleteConcertHandler(req, res, rawId) {
  const concertID = Number(rawId);
  if (!Number.isInteger(concertID) || concertID <= 0) {
    sendJson(res, 400, { success: false, message: 'concertID must be a positive integer' });
    return;
  }

  try {
    const existing = await getConcertById(concertID);
    if (!existing) {
      sendJson(res, 404, { success: false, message: 'Concert not found' });
      return;
    }

    await deleteConcert(concertID);

    sendJson(res, 200, {
      success: true,
      message: 'Concert deleted successfully',
      concertID,
      removedConcert: existing,
      historyEntriesRemoved: 0,
    });
  } catch (err) {
    console.error('deleteConcert:', err);
    sendJson(res, 500, { success: false, message: err.message || 'Unable to delete concert' });
  }
}

module.exports = {
  getAllConcerts,
  createConcert,
  editConcert,
  deleteConcert: deleteConcertHandler,
};
