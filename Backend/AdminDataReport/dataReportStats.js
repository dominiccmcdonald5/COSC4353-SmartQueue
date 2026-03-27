const fs = require('fs');
const path = require('path');

/**
 * Get all admin data report statistics
 * Returns: total users, total events, total revenue, average queue time,
 * top 5 genres, pass distribution, monthly revenue trend, and user growth stats
 */
const getDataReportStats = async (req, res) => {
    try {
        // Read mock data from mockDataStore.json
        const mockDataPath = path.join(__dirname, '../mockDataStore.json');
        const mockDataRaw = fs.readFileSync(mockDataPath, 'utf8');
        const mockData = JSON.parse(mockDataRaw);

        const users = mockData.USER || [];
        const concerts = mockData.CONCERT || [];
        const history = mockData.HISTORY || [];

        // 1. Total number of users
        const totalUsers = users.length;

        // 2. Total number of events
        const totalEvents = concerts.length;

        // 3. Total revenue (sum of completed transactions)
        const totalRevenue = history
            .filter(h => h.status === 'completed')
            .reduce((sum, h) => sum + (h.totalCost || 0), 0);

        // 4. Average queue time (from all history records)
        const averageQueueTime = history.length > 0
            ? Math.round(history.reduce((sum, h) => sum + (h.waitTime || 0), 0) / history.length)
            : 0;

        // 5. Top 5 most popular genres
        const genreCount = {};
        concerts.forEach(concert => {
            if (concert.genre) {
                genreCount[concert.genre] = (genreCount[concert.genre] || 0) + 1;
            }
        });

        const topGenres = Object.entries(genreCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([genre, count]) => ({
                genre,
                count
            }));

        // 6. Pass distribution (None, Gold, Silver, etc.)
        const passDistribution = {};
        users.forEach(user => {
            const passType = user.passStatus || 'None';
            passDistribution[passType] = (passDistribution[passType] || 0) + 1;
        });

        const passDistributionFormatted = Object.entries(passDistribution)
            .map(([passType, count]) => ({
                passType,
                count,
                percentage: ((count / totalUsers) * 100).toFixed(2)
            }));

        // 7. Monthly revenue trend
        const monthlyRevenue = {};
        history
            .filter(h => h.status === 'completed')
            .forEach(h => {
                if (h.queuedAt) {
                    const date = new Date(h.queuedAt);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (h.totalCost || 0);
                }
            });

        const monthlyRevenueArray = Object.entries(monthlyRevenue)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, revenue]) => ({
                month,
                revenue: parseFloat(revenue.toFixed(2))
            }));

        // 8. User growth (cumulative count of users by signup month)
        const usersByMonth = {};
        users.forEach(user => {
            if (user.createdAt) {
                const date = new Date(user.createdAt);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                usersByMonth[monthKey] = (usersByMonth[monthKey] || 0) + 1;
            }
        });

        // Convert to cumulative growth
        const userGrowthArray = Object.entries(usersByMonth)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, count], index, arr) => {
                // Calculate cumulative count
                const cumulativeCount = arr
                    .slice(0, index + 1)
                    .reduce((sum, [_, c]) => sum + c, 0);
                return {
                    month,
                    newUsers: count,
                    totalUsers: cumulativeCount
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
