const { allMockData } = require('../../mockData');

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

            const concerts = historyRecords
                .map((record) => {
                    const concert = allMockData.CONCERT.find((item) => item.concertID === record.concertID);
                    if (!concert) {
                        return null;
                    }

                    return {
                        ...concert,
                        history: {
                            historyID: record.historyID,
                            ticketCount: record.ticketCount,
                            totalCost: record.totalCost,
                            waitTime: record.waitTime,
                            status: record.status,
                            inLineStatus: record.inLineStatus,
                            queuedAt: record.queuedAt,
                        },
                    };
                })
                .filter(Boolean);

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