const pool = require('../database');

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

/** GET — list every concert from database */
function getAllConcerts(req, res) {
  const query = `
    SELECT 
      concert_id,
      concert_name,
      artist_name,
      genre,
      event_date,
      venue,
      capacity,
      ticket_price,
      concert_image,
      concert_status
    FROM concerts
    ORDER BY concert_id ASC
  `;
  
  pool.query(query, (error, rows) => {
    if (error) {
      console.error('Error fetching concerts:', error);
      sendJson(res, 500, { success: false, message: 'Database error', error: error.message });
      return;
    }
    
    sendJson(res, 200, {
      success: true,
      count: rows.length,
      concerts: rows,
    });
  });
}

const EDITABLE_FIELDS = [
  'concert_name',
  'artist_name',
  'genre',
  'event_date',
  'venue',
  'capacity',
  'ticket_price',
  'concert_image',
  'concert_status',
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

  if (Object.prototype.hasOwnProperty.call(payload, 'concert_name')) {
    if (typeof payload.concert_name !== 'string' || !payload.concert_name.trim()) {
      errors.push('concert_name must be a non-empty string');
    } else if (payload.concert_name.trim().length > 200) {
      errors.push('concert_name must be at most 200 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'artist_name')) {
    if (typeof payload.artist_name !== 'string' || !payload.artist_name.trim()) {
      errors.push('artist_name must be a non-empty string');
    } else if (payload.artist_name.trim().length > 200) {
      errors.push('artist_name must be at most 200 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'genre')) {
    if (typeof payload.genre !== 'string' || !payload.genre.trim()) {
      errors.push('genre must be a non-empty string');
    } else if (payload.genre.trim().length > 100) {
      errors.push('genre must be at most 100 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'venue')) {
    if (typeof payload.venue !== 'string' || !payload.venue.trim()) {
      errors.push('venue must be a non-empty string');
    } else if (payload.venue.trim().length > 200) {
      errors.push('venue must be at most 200 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'event_date')) {
    const d = new Date(payload.event_date);
    if (Number.isNaN(d.getTime())) {
      errors.push('event_date must be a valid date (ISO string recommended)');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'capacity')) {
    if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
      errors.push('capacity must be a positive integer');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'ticket_price')) {
    const p = Number(payload.ticket_price);
    if (!Number.isFinite(p) || p < 0) {
      errors.push('ticket_price must be a non-negative number');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'concert_image')) {
    if (typeof payload.concert_image !== 'string' || !payload.concert_image.trim()) {
      errors.push('concert_image must be a non-empty string');
    } else if (payload.concert_image.trim().length > 500) {
      errors.push('concert_image URL must be at most 500 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'concert_status')) {
    const s = String(payload.concert_status).toLowerCase();
    if (!CONCERT_STATUSES.has(s)) {
      errors.push('concert_status must be one of: open, sold_out');
    }
  }

  return errors;
}

/** POST — create a new concert in database */
async function createConcert(req, res) {
  try {
    const payload = await readJsonBody(req);
    const errors = [];

    if (!payload.concert_name || typeof payload.concert_name !== 'string' || !payload.concert_name.trim()) {
      errors.push('concert_name is required');
    }
    if (!payload.artist_name || typeof payload.artist_name !== 'string' || !payload.artist_name.trim()) {
      errors.push('artist_name is required');
    }
    if (!payload.genre || typeof payload.genre !== 'string' || !payload.genre.trim()) {
      errors.push('genre is required');
    }
    if (!payload.venue || typeof payload.venue !== 'string' || !payload.venue.trim()) {
      errors.push('venue is required');
    }
    if (!payload.event_date || Number.isNaN(new Date(payload.event_date).getTime())) {
      errors.push('event_date must be a valid date');
    }
    if (!Number.isInteger(Number(payload.capacity)) || Number(payload.capacity) < 1) {
      errors.push('capacity must be a positive integer');
    }
    const price = Number(payload.ticket_price);
    if (!Number.isFinite(price) || price < 0) {
      errors.push('ticket_price must be a non-negative number');
    }

    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const insertQuery = `
      INSERT INTO concerts (
        concert_name, artist_name, genre, event_date, venue, 
        capacity, ticket_price, concert_image, concert_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const concertImage = (typeof payload.concert_image === 'string' && payload.concert_image.trim())
      ? payload.concert_image.trim()
      : `https://picsum.photos/seed/concert-${Date.now()}/600/400`;
    
    pool.query(insertQuery, [
      payload.concert_name.trim(),
      payload.artist_name.trim(),
      payload.genre.trim(),
      payload.event_date,
      payload.venue.trim(),
      Number(payload.capacity),
      Number(price.toFixed(2)),
      concertImage,
      'open'
    ], (error, result) => {
      if (error) {
        console.error('Error creating concert:', error);
        sendJson(res, 500, { success: false, message: 'Database error', error: error.message });
        return;
      }
      
      // Fetch the newly created concert
      pool.query('SELECT * FROM concerts WHERE concert_id = ?', [result.insertId], (err, rows) => {
        if (err) {
          sendJson(res, 500, { success: false, message: 'Failed to retrieve new concert' });
          return;
        }
        
        sendJson(res, 201, {
          success: true,
          message: 'Concert created successfully',
          concert: rows[0],
        });
      });
    });
  } catch (error) {
    console.error('Error in createConcert:', error);
    sendJson(res, 500, { success: false, message: error.message || 'Unable to create concert' });
  }
}

/** PUT — partial update by concert_id */
async function editConcert(req, res, rawId) {
  const concert_id = Number(rawId);
  if (!Number.isInteger(concert_id) || concert_id <= 0) {
    sendJson(res, 400, { success: false, message: 'concert_id must be a positive integer' });
    return;
  }

  // Check if concert exists
  pool.query('SELECT * FROM concerts WHERE concert_id = ?', [concert_id], (err, existing) => {
    if (err) {
      sendJson(res, 500, { success: false, message: 'Database error' });
      return;
    }
    
    if (existing.length === 0) {
      sendJson(res, 404, { success: false, message: 'Concert not found' });
      return;
    }
    
    // Continue with update
    updateConcert(req, res, concert_id, existing[0]);
  });
}

async function updateConcert(req, res, concert_id, currentConcert) {
  try {
    const payload = await readJsonBody(req);
    const errors = validateEditPayload(payload);
    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(payload, 'concert_name')) {
      updates.push('concert_name = ?');
      values.push(payload.concert_name.trim());
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'artist_name')) {
      updates.push('artist_name = ?');
      values.push(payload.artist_name.trim());
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'genre')) {
      updates.push('genre = ?');
      values.push(payload.genre.trim());
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'venue')) {
      updates.push('venue = ?');
      values.push(payload.venue.trim());
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'event_date')) {
      updates.push('event_date = ?');
      values.push(payload.event_date);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'capacity')) {
      updates.push('capacity = ?');
      values.push(payload.capacity);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'ticket_price')) {
      updates.push('ticket_price = ?');
      values.push(Number(payload.ticket_price).toFixed(2));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'concert_image')) {
      updates.push('concert_image = ?');
      values.push(payload.concert_image.trim());
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'concert_status')) {
      updates.push('concert_status = ?');
      values.push(String(payload.concert_status).toLowerCase());
    }

    if (updates.length === 0) {
      sendJson(res, 400, { success: false, message: 'No valid fields to update' });
      return;
    }

    values.push(concert_id);
    const updateQuery = `UPDATE concerts SET ${updates.join(', ')} WHERE concert_id = ?`;
    
    pool.query(updateQuery, values, (error) => {
      if (error) {
        console.error('Error updating concert:', error);
        sendJson(res, 500, { success: false, message: 'Database error', error: error.message });
        return;
      }
      
      // Fetch the updated concert
      pool.query('SELECT * FROM concerts WHERE concert_id = ?', [concert_id], (err, rows) => {
        if (err) {
          sendJson(res, 500, { success: false, message: 'Failed to retrieve updated concert' });
          return;
        }
        
        sendJson(res, 200, {
          success: true,
          message: 'Concert updated successfully',
          concert: rows[0],
        });
      });
    });
  } catch (error) {
    console.error('Error in editConcert:', error);
    sendJson(res, 500, { success: false, message: error.message || 'Unable to update concert' });
  }
}

/** DELETE — remove concert and related queue_history rows */
function deleteConcert(req, res, rawId) {
  const concert_id = Number(rawId);
  if (!Number.isInteger(concert_id) || concert_id <= 0) {
    sendJson(res, 400, { success: false, message: 'concert_id must be a positive integer' });
    return;
  }

  // First check if concert exists
  pool.query('SELECT * FROM concerts WHERE concert_id = ?', [concert_id], (err, existing) => {
    if (err) {
      console.error('Error checking concert:', err);
      sendJson(res, 500, { success: false, message: 'Database error' });
      return;
    }
    
    if (existing.length === 0) {
      sendJson(res, 404, { success: false, message: 'Concert not found' });
      return;
    }

    // Delete related queue_history entries first (due to foreign key constraint with ON DELETE CASCADE)
    // The foreign key has ON DELETE CASCADE, so this will happen automatically, but we can do it explicitly
    pool.query('DELETE FROM queue_history WHERE concert_id = ?', [concert_id], (error) => {
      if (error) {
        console.error('Error deleting queue_history:', error);
        // Continue anyway - cascade might handle it
      }
      
      // Delete the concert
      pool.query('DELETE FROM concerts WHERE concert_id = ?', [concert_id], (err2) => {
        if (err2) {
          console.error('Error deleting concert:', err2);
          sendJson(res, 500, { success: false, message: 'Failed to delete concert', error: err2.message });
          return;
        }
        
        sendJson(res, 200, {
          success: true,
          message: 'Concert deleted successfully',
          concert_id: concert_id,
          removedConcert: existing[0],
        });
      });
    });
  });
}

module.exports = {
  getAllConcerts,
  createConcert,
  editConcert,
  deleteConcert,
};