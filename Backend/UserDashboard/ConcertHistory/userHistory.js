const { pool } = require('../../database');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
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

const getConcertHistory = async (req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const parsedBody = body ? JSON.parse(body) : {};
      const userID = Number(parsedBody.userID);

      if (!Number.isInteger(userID) || userID <= 0) {
        sendJson(res, 400, { success: false, message: 'Valid userID is required' });
        return;
      }

      const [userCheckRows] = await pool.promise().query(
        'SELECT user_id FROM users WHERE user_id = ? LIMIT 1',
        [userID]
      );
      if (!Array.isArray(userCheckRows) || userCheckRows.length === 0) {
        sendJson(res, 404, { success: false, message: 'User not found' });
        return;
      }

      const seatCol = await seatSelectionColumnExists();
      const seatSelect = seatCol ? ', qh.seat_selection AS seatSelection' : '';

      const [rows] = await pool.promise().query(
        `
        SELECT
          qh.history_id AS historyID,
          qh.ticket_count AS ticketCount,
          qh.total_cost AS totalCost,
          qh.wait_time AS waitTime,
          qh.status AS status,
          qh.in_line_status AS inLineStatus,
          qh.queued_at AS queuedAt
          ${seatSelect},
          c.concert_id AS concertID,
          c.concert_name AS concertName,
          c.artist_name AS artistName,
          c.genre AS genre,
          c.event_date AS date,
          c.venue AS venue,
          c.capacity AS capacity,
          c.ticket_price AS ticketPrice,
          c.concert_image AS concertImage,
          c.concert_status AS concertStatus
        FROM queue_history qh
        INNER JOIN concerts c ON c.concert_id = qh.concert_id
        WHERE qh.user_id = ?
        ORDER BY qh.queued_at DESC, qh.history_id DESC
        `,
        [userID]
      );

      const concerts = (rows || []).map((r) => {
        let seatSelection = undefined;
        if (seatCol && r.seatSelection != null && String(r.seatSelection).trim() !== '') {
          try {
            const parsed = JSON.parse(String(r.seatSelection));
            if (Array.isArray(parsed) && parsed.length > 0) {
              seatSelection = parsed;
            }
          } catch {
            // ignore bad JSON
          }
        }
        return {
          concertID: Number(r.concertID),
          concertName: r.concertName,
          artistName: r.artistName,
          genre: r.genre,
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
          venue: r.venue,
          capacity: Number(r.capacity),
          ticketPrice: Number(r.ticketPrice),
          concertImage: r.concertImage,
          concertStatus: r.concertStatus,
          history: {
            historyID: Number(r.historyID),
            ticketCount: Number(r.ticketCount),
            totalCost: Number(r.totalCost),
            waitTime: Number(r.waitTime),
            status: r.status,
            inLineStatus: r.inLineStatus,
            queuedAt: r.queuedAt instanceof Date ? r.queuedAt.toISOString() : r.queuedAt,
            ...(seatSelection ? { seatSelection } : {}),
          },
        };
      });

      sendJson(res, 200, {
        success: true,
        userID,
        count: concerts.length,
        concerts,
      });
    } catch (err) {
      console.error('Error while fetching user concert history:', err);
      sendJson(res, 500, { success: false, message: err.message || 'Failed to fetch concert history' });
    }
  });
};

module.exports = { getConcertHistory };