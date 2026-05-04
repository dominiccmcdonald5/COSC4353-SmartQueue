const { promisePool, queryWithRetry } = require('../database');

function isUnknownColumnError(err) {
  return err && (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054);
}

/** YYYY-MM-DD for API; avoids UTC shift from toISOString() on <input type="date"> round-trips */
function formatEventDateForApi(d) {
  if (d == null) return '';
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** DB columns (snake_case) ↔ API shape (camelCase / concertID) */
function rowToConcert(row) {
  if (!row) return null;
  const d = row.event_date;
  const dateIso = formatEventDateForApi(d);
  const tmin = row.ticket_price_min;
  const tmax = row.ticket_price_max;
  return {
    concertID: Number(row.concert_id),
    concertName: row.concert_name,
    artistName: row.artist_name,
    genre: row.genre,
    date: dateIso,
    venue: row.venue,
    capacity: Number(row.capacity),
    ticketPrice: Number(row.ticket_price),
    ...(tmin != null ? { ticketPriceMin: Number(tmin) } : {}),
    ...(tmax != null ? { ticketPriceMax: Number(tmax) } : {}),
    concertImage: row.concert_image,
    concertStatus: String(row.concert_status || 'open').toLowerCase(),
  };
}

async function listConcertsForAdmin() {
  let rows;
  try {
    [rows] = await promisePool.query(
      `SELECT concert_id, concert_name, artist_name, genre, event_date, venue,
              capacity, ticket_price, ticket_price_min, ticket_price_max, concert_image, concert_status
       FROM concerts
       ORDER BY concert_id ASC`
    );
  } catch (err) {
    if (!isUnknownColumnError(err)) throw err;
    [rows] = await promisePool.query(
      `SELECT concert_id, concert_name, artist_name, genre, event_date, venue,
              capacity, ticket_price, concert_image, concert_status
       FROM concerts
       ORDER BY concert_id ASC`
    );
  }
  return (rows || []).map(rowToConcert);
}

async function listConcertsByDate() {
  let rows;
  try {
    [rows] = await promisePool.query(
      `SELECT concert_id, concert_name, artist_name, genre, event_date, venue,
              capacity, ticket_price, ticket_price_min, ticket_price_max, concert_image, concert_status
       FROM concerts
       ORDER BY event_date ASC, concert_id ASC`
    );
  } catch (err) {
    if (!isUnknownColumnError(err)) throw err;
    [rows] = await promisePool.query(
      `SELECT concert_id, concert_name, artist_name, genre, event_date, venue,
              capacity, ticket_price, concert_image, concert_status
       FROM concerts
       ORDER BY event_date ASC, concert_id ASC`
    );
  }
  return (rows || []).map(rowToConcert);
}

async function getConcertById(concertId) {
  let rows;
  try {
    [rows] = await promisePool.execute(
      `SELECT concert_id, concert_name, artist_name, genre, event_date, venue,
              capacity, ticket_price, ticket_price_min, ticket_price_max, concert_image, concert_status
       FROM concerts
       WHERE concert_id = ?
       LIMIT 1`,
      [concertId]
    );
  } catch (err) {
    if (!isUnknownColumnError(err)) throw err;
    [rows] = await promisePool.execute(
      `SELECT concert_id, concert_name, artist_name, genre, event_date, venue,
              capacity, ticket_price, concert_image, concert_status
       FROM concerts
       WHERE concert_id = ?
       LIMIT 1`,
      [concertId]
    );
  }
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  return rowToConcert(row);
}

async function insertConcert(values) {
  try {
    const [result] = await promisePool.execute(
      `INSERT INTO concerts (
         concert_name, artist_name, genre, event_date, venue,
         capacity, ticket_price, ticket_price_min, ticket_price_max, concert_image, concert_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        values.concertName,
        values.artistName,
        values.genre,
        values.concertDate,
        values.venue,
        values.capacity,
        values.ticketPrice,
        values.ticketPriceMin ?? null,
        values.ticketPriceMax ?? null,
        values.concertImage,
        values.concertStatus,
      ]
    );
    return result.insertId;
  } catch (err) {
    if (!isUnknownColumnError(err)) throw err;
  }

  const [result] = await promisePool.execute(
    `INSERT INTO concerts (
       concert_name, artist_name, genre, event_date, venue,
       capacity, ticket_price, concert_image, concert_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.concertName,
      values.artistName,
      values.genre,
      values.concertDate,
      values.venue,
      values.capacity,
      values.ticketPrice,
      values.concertImage,
      values.concertStatus,
    ]
  );
  return result.insertId;
}

async function updateConcert(concertId, patch) {
  const p = { ...patch };
  if (Object.prototype.hasOwnProperty.call(p, 'concert_date')) {
    p.event_date = p.concert_date;
    delete p.concert_date;
  }
  const entries = Object.entries(p).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return 0;
  const cols = entries.map(([k]) => `\`${k}\` = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  vals.push(concertId);
  const [result] = await promisePool.execute(
    `UPDATE concerts SET ${cols} WHERE concert_id = ?`,
    vals
  );
  return result.affectedRows;
}

async function deleteConcert(concertId) {
  const [result] = await promisePool.execute(`DELETE FROM concerts WHERE concert_id = ?`, [concertId]);
  return result.affectedRows;
}

module.exports = {
  rowToConcert,
  listConcertsForAdmin,
  listConcertsByDate,
  getConcertById,
  insertConcert,
  updateConcert,
  deleteConcert,
};
