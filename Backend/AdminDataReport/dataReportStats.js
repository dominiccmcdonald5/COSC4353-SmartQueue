const pool = require('../database');

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Get all admin data report statistics
 * Returns: total users, total events, total revenue, average queue time,
 * top 5 genres, pass distribution, monthly revenue trend, and user growth stats
 */
const getDataReportStats = async (req, res) => {
    try {
        const [
            [userCountRows],
            [eventCountRows],
            [revenueRows],
            [averageQueueTimeRows],
            [topGenresRows],
            [passDistributionRows],
            [monthlyRevenueRows],
            [userGrowthRows]
        ] = await Promise.all([
            pool.promise().query('SELECT COUNT(*) AS totalUsers FROM users'),
            pool.promise().query('SELECT COUNT(*) AS totalEvents FROM concerts'),
            pool.promise().query(`
                SELECT COALESCE(SUM(total_cost), 0) AS totalRevenue
                FROM queue_history
                WHERE status = 'completed'
            `),
            pool.promise().query(`
                SELECT COALESCE(ROUND(AVG(wait_time)), 0) AS averageQueueTime
                FROM queue_history
            `),
            pool.promise().query(`
                SELECT genre, COUNT(*) AS count
                FROM concerts
                WHERE genre IS NOT NULL AND genre != ''
                GROUP BY genre
                ORDER BY count DESC, genre ASC
                LIMIT 5
            `),
            pool.promise().query(`
                SELECT pass_status AS passType, COUNT(*) AS count
                FROM users
                GROUP BY pass_status
                ORDER BY count DESC, pass_status ASC
            `),
            pool.promise().query(`
                SELECT DATE_FORMAT(queued_at, '%Y-%m') AS month,
                       COALESCE(SUM(total_cost), 0) AS revenue
                FROM queue_history
                WHERE status = 'completed' AND queued_at IS NOT NULL
                GROUP BY DATE_FORMAT(queued_at, '%Y-%m')
                ORDER BY month ASC
            `),
            pool.promise().query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
                       COUNT(*) AS newUsers
                FROM users
                WHERE created_at IS NOT NULL
                GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ORDER BY month ASC
            `)
        ]);

        const totalUsers = toNumber(userCountRows[0]?.totalUsers);
        const totalEvents = toNumber(eventCountRows[0]?.totalEvents);
        const totalRevenue = toNumber(revenueRows[0]?.totalRevenue);
        const averageQueueTime = toNumber(averageQueueTimeRows[0]?.averageQueueTime);

        const topGenres = topGenresRows.map((row) => ({
            genre: row.genre,
            count: toNumber(row.count)
        }));

        const passDistributionFormatted = passDistributionRows.map((row) => {
            const count = toNumber(row.count);
            return {
                passType: row.passType || 'None',
                count,
                percentage: totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(2) : '0.00'
            };
        });

        const monthlyRevenueArray = monthlyRevenueRows.map((row) => ({
            month: row.month,
            revenue: parseFloat(toNumber(row.revenue).toFixed(2))
        }));

        let runningUsers = 0;
        const userGrowthArray = userGrowthRows.map((row) => {
            const newUsers = toNumber(row.newUsers);
            runningUsers += newUsers;
            return {
                month: row.month,
                newUsers,
                totalUsers: runningUsers
            };
        });

        // Compile all statistics
        const reportStats = {
            totalUsers,
            totalEvents,
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            averageQueueTime: `${averageQueueTime} minutes`,
            topGenres,
            passDistribution: passDistributionFormatted,
            monthlyRevenueTrend: monthlyRevenueArray,
            userGrowth: userGrowthArray,
            reportGeneratedAt: new Date().toISOString()
        };

        // Send response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: reportStats
        }, null, 2));

    } catch (error) {
        console.error('Error generating data report stats:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message || 'Failed to generate data report'
        }));
    }
};

module.exports = {
    getDataReportStats
};
