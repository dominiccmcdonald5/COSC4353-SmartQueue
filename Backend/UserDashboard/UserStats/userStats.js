const { pool } = require('../../database');

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

const getUserStats = async (req, res) => {
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

            const [userCheckRows] = await pool.promise().query(
                'SELECT user_id FROM users WHERE user_id = ? LIMIT 1',
                [userID]
            );

            if (userCheckRows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'User not found',
                }));
                return;
            }

            const [[summaryRows], [topGenresRows], [spendingByConcertRows]] = await Promise.all([
                pool.promise().query(
                    `
                    SELECT
                        COUNT(*) AS totalQueues,
                        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS successfulQueues,
                        COALESCE(SUM(total_cost), 0) AS totalSpending
                    FROM queue_history
                    WHERE user_id = ?
                    `,
                    [userID]
                ),
                pool.promise().query(
                    `
                    SELECT
                        c.genre AS genre,
                        COUNT(*) AS frequency
                    FROM queue_history qh
                    INNER JOIN concerts c ON c.concert_id = qh.concert_id
                    WHERE qh.user_id = ? AND c.genre IS NOT NULL AND c.genre != ''
                    GROUP BY c.genre
                    ORDER BY frequency DESC, c.genre ASC
                    LIMIT 3
                    `,
                    [userID]
                ),
                pool.promise().query(
                    `
                    SELECT
                        c.concert_id AS concertID,
                        c.concert_name AS concertName,
                        c.artist_name AS artistName,
                        c.genre,
                        c.event_date AS date,
                        c.venue,
                        c.capacity,
                        c.ticket_price AS ticketPrice,
                        c.concert_image AS concertImage,
                        c.concert_status AS concertStatus,
                        COUNT(qh.history_id) AS queueCount,
                        COALESCE(SUM(qh.ticket_count), 0) AS totalTickets,
                        COALESCE(SUM(qh.total_cost), 0) AS totalSpent
                    FROM queue_history qh
                    INNER JOIN concerts c ON c.concert_id = qh.concert_id
                    WHERE qh.user_id = ?
                    GROUP BY
                        c.concert_id,
                        c.concert_name,
                        c.artist_name,
                        c.genre,
                        c.event_date,
                        c.venue,
                        c.capacity,
                        c.ticket_price,
                        c.concert_image,
                        c.concert_status
                    ORDER BY totalSpent DESC, c.concert_id ASC
                    `,
                    [userID]
                )
            ]);

            const summaryRow = summaryRows[0] || {};

            const totalQueues = toNumber(summaryRow.totalQueues);
            const successfulQueues = toNumber(summaryRow.successfulQueues);
            let totalSpending = toNumber(summaryRow.totalSpending);

            const topGenresNormalized = topGenresRows.map((row) => ({
                genre: row.genre,
                frequency: toNumber(row.frequency)
            }));

            const firstPopularGenre = topGenresNormalized[0]?.genre || null;
            const secondPopularGenre = topGenresNormalized[1]?.genre || null;
            const thirdPopularGenre = topGenresNormalized[2]?.genre || null;

            const spendingByConcert = spendingByConcertRows
                .map((item) => ({
                    concertID: toNumber(item.concertID),
                    concertName: item.concertName,
                    artistName: item.artistName,
                    genre: item.genre,
                    date: item.date,
                    venue: item.venue,
                    capacity: toNumber(item.capacity),
                    ticketPrice: toNumber(item.ticketPrice),
                    concertImage: item.concertImage,
                    concertStatus: item.concertStatus,
                    queueCount: toNumber(item.queueCount),
                    totalTickets: toNumber(item.totalTickets),
                    totalSpent: Number(toNumber(item.totalSpent).toFixed(2)),
                }));

            totalSpending = Number(totalSpending.toFixed(2));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                userID,
                totalQueues,
                successfulQueues,
                firstPopularGenre,
                secondPopularGenre,
                thirdPopularGenre,
                totalSpending,
                spendingByConcert,
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
    getUserStats,
}