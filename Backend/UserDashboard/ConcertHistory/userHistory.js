const pool = require('../../database');

const getConcertHistory = async (req, res) => {
    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const parsedBody = body ? JSON.parse(body) : {};
            const userID = Number(parsedBody.userID);

            if (!Number.isInteger(userID) || userID <= 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Valid userID is required',
                }));
                return;
            }

            // Check if user exists
            const [userCheck] = await pool.promise().query(
                'SELECT user_id FROM users WHERE user_id = ?',
                [userID]
            );

            if (userCheck.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'User not found',
                }));
                return;
            }

            // Get user's history records with concert details
            const [historyRecords] = await pool.promise().query(
                `SELECT h.history_id, h.user_id, h.concert_id, h.ticket_count, h.total_cost, 
                        h.wait_time, h.status, h.in_line_status, h.queued_at,
                        c.concert_id, c.concert_name, c.artist_name, c.genre, c.event_date, c.venue, 
                        c.capacity, c.ticket_price, c.concert_image, c.concert_status
                 FROM queue_history h
                 JOIN concerts c ON h.concert_id = c.concert_id
                 WHERE h.user_id = ?
                 ORDER BY h.queued_at DESC`,
                [userID]
            );

            const concerts = historyRecords.map((record) => {
                return {
                    concert_id: record.concert_id,
                    concert_name: record.concert_name,
                    artist_name: record.artist_name,
                    genre: record.genre,
                    event_date: record.event_date,
                    venue: record.venue,
                    capacity: record.capacity,
                    ticket_price: record.ticket_price,
                    concert_image: record.concert_image,
                    concert_status: record.concert_status,
                    history: {
                        history_id: record.history_id,
                        ticket_count: record.ticket_count,
                        total_cost: record.total_cost,
                        wait_time: record.wait_time,
                        status: record.status,
                        in_line_status: record.in_line_status,
                        queued_at: record.queued_at,
                    },
                };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                userID,
                count: concerts.length,
                concerts,
            }));
            return;
        }
        catch (err) {
            console.error('Error while fetching user concert history:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: err.message || 'Failed to fetch concert history',
            }));
        }
    });
};

module.exports = {
    getConcertHistory,
}