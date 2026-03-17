const { allMockData } = require('../../mockData');

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

            const userCheck = allMockData.USER.find((item) => item.userID === userID);

            if (!userCheck) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'User not found',
                }));
                return;
            }

            const historyRecords = allMockData.HISTORY.filter((record) => record.userID === userID);

            const totalQueues = historyRecords.length;
            const successfulQueues = historyRecords.filter((record) => record.status === 'completed').length;

            const genreFrequency = {};
            const spendByConcertMap = {};
            let totalSpending = 0;

            historyRecords.forEach((record) => {
                const concert = allMockData.CONCERT.find((item) => item.concertID === record.concertID);
                if (!concert) {
                    return;
                }

                totalSpending += Number(record.totalCost || 0);

                genreFrequency[concert.genre] = (genreFrequency[concert.genre] || 0) + 1;

                if (!spendByConcertMap[concert.concertID]) {
                    spendByConcertMap[concert.concertID] = {
                        concertID: concert.concertID,
                        concertName: concert.concertName,
                        artistName: concert.artistName,
                        genre: concert.genre,
                        date: concert.date,
                        venue: concert.venue,
                        capacity: concert.capacity,
                        ticketPrice: concert.ticketPrice,
                        concertImage: concert.concertImage,
                        concertStatus: concert.concertStatus,
                        queueCount: 0,
                        totalTickets: 0,
                        totalSpent: 0,
                    };
                }

                spendByConcertMap[concert.concertID].queueCount += 1;
                spendByConcertMap[concert.concertID].totalTickets += Number(record.ticketCount || 0);
                spendByConcertMap[concert.concertID].totalSpent += Number(record.totalCost || 0);
            });

            const topGenres = Object.entries(genreFrequency)
                .sort((first, second) => second[1] - first[1])
                .slice(0, 3)
                .map(([genre, frequency]) => ({ genre, frequency }));

            const firstPopularGenre = topGenres[0]?.genre || null;
            const secondPopularGenre = topGenres[1]?.genre || null;
            const thirdPopularGenre = topGenres[2]?.genre || null;

            const spendingByConcert = Object.values(spendByConcertMap)
                .map((item) => ({
                    ...item,
                    totalSpent: Number(item.totalSpent.toFixed(2)),
                }))
                .sort((first, second) => second.totalSpent - first.totalSpent);

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