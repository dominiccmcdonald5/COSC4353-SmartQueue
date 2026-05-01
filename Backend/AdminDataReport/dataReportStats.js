const fs = require('fs');
const path = require('path');
const url = require('url');

function readMockDataStore() {
    const mockDataPath = path.join(__dirname, '../mockDataStore.json');
    const mockDataRaw = fs.readFileSync(mockDataPath, 'utf8');
    return JSON.parse(mockDataRaw);
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
}

function escapeCsvValue(value) {
    if (value == null) return '';
    const text = String(value);
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function toCsv(rows, headers) {
    const headerLine = headers.map((h) => escapeCsvValue(h.label)).join(',');
    const bodyLines = rows.map((row) =>
        headers
            .map((h) => escapeCsvValue(typeof h.getter === 'function' ? h.getter(row) : row[h.key]))
            .join(','),
    );
    return [headerLine, ...bodyLines].join('\n');
}

function getReportModel() {
    const mockData = readMockDataStore();

    const users = Array.isArray(mockData.USER) ? mockData.USER : [];
    const concerts = Array.isArray(mockData.CONCERT) ? mockData.CONCERT : [];
    const history = Array.isArray(mockData.HISTORY) ? mockData.HISTORY : [];

    const userMap = new Map(users.map((u) => [Number(u.userID), u]));
    const concertMap = new Map(concerts.map((concert) => [Number(concert.concertID), concert]));

    const userStatsMap = new Map();
    for (const user of users) {
        userStatsMap.set(Number(user.userID), {
            totalQueues: 0,
            completedQueues: 0,
            cancelledQueues: 0,
            activeQueues: 0,
            totalWaitTime: 0,
            lastQueuedAt: null,
            participationHistory: [],
        });
    }

    const serviceStatsMap = new Map();
    for (const concert of concerts) {
        serviceStatsMap.set(Number(concert.concertID), {
            totalQueueEntries: 0,
            usersServed: 0,
            activeQueueEntries: 0,
            cancelledEntries: 0,
            totalWaitTime: 0,
            totalTicketsProcessed: 0,
            revenueFromCompleted: 0,
        });
    }

    let completedRevenue = 0;
    let totalWaitAcrossAll = 0;
    let usersServed = 0;
    let activeQueueEntries = 0;
    let cancelledEntries = 0;

    const queueEntriesByHour = {};
    const monthlyRevenue = {};
    const allQueueHistory = [];

    for (const entry of history) {
        const userID = Number(entry.userID);
        const concertID = Number(entry.concertID);
        const waitTime = Number(entry.waitTime) || 0;
        const totalCost = Number(entry.totalCost) || 0;
        const ticketCount = Number(entry.ticketCount) || 0;
        const status = String(entry.status || '').toLowerCase();
        const inLineStatus = String(entry.inLineStatus || '').toLowerCase();
        const queuedAt = entry.queuedAt ? new Date(entry.queuedAt) : null;
        const queuedAtIso = queuedAt && !Number.isNaN(queuedAt.getTime()) ? queuedAt.toISOString() : null;

        totalWaitAcrossAll += waitTime;

        if (status === 'completed') {
            usersServed += 1;
            completedRevenue += totalCost;
            if (queuedAtIso) {
                const monthKey = queuedAtIso.slice(0, 7);
                monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + totalCost;
            }
        } else if (status === 'queued') {
            activeQueueEntries += 1;
        } else if (status === 'cancelled') {
            cancelledEntries += 1;
        }

        if (queuedAt && !Number.isNaN(queuedAt.getTime())) {
            const hour = String(queuedAt.getUTCHours()).padStart(2, '0');
            queueEntriesByHour[hour] = (queueEntriesByHour[hour] || 0) + 1;
        }

        const concert = concertMap.get(concertID);
        const user = userMap.get(userID);
        const firstName = String(user?.firstName || '').trim();
        const lastName = String(user?.lastName || '').trim();
        const customerName = `${firstName} ${lastName}`.trim() || `User #${userID}`;
        const historyRecord = {
            historyID: Number(entry.historyID),
            userID,
            customerName,
            email: user?.email || '',
            concertID,
            concertName: concert?.concertName || `Concert #${concertID}`,
            genre: concert?.genre || '',
            venue: concert?.venue || '',
            status,
            inLineStatus,
            ticketCount,
            totalCost: Number(totalCost.toFixed(2)),
            waitTimeMinutes: waitTime,
            queuedAt: queuedAtIso,
        };
        allQueueHistory.push(historyRecord);

        if (userStatsMap.has(userID)) {
            const userStats = userStatsMap.get(userID);
            userStats.totalQueues += 1;
            userStats.totalWaitTime += waitTime;
            userStats.participationHistory.push(historyRecord);
            if (status === 'completed') userStats.completedQueues += 1;
            if (status === 'cancelled') userStats.cancelledQueues += 1;
            if (status === 'queued') userStats.activeQueues += 1;
            if (queuedAtIso && (!userStats.lastQueuedAt || queuedAtIso > userStats.lastQueuedAt)) {
                userStats.lastQueuedAt = queuedAtIso;
            }
        }

        if (serviceStatsMap.has(concertID)) {
            const serviceStats = serviceStatsMap.get(concertID);
            serviceStats.totalQueueEntries += 1;
            serviceStats.totalWaitTime += waitTime;
            serviceStats.totalTicketsProcessed += ticketCount;
            if (status === 'completed') {
                serviceStats.usersServed += 1;
                serviceStats.revenueFromCompleted += totalCost;
            }
            if (status === 'queued') serviceStats.activeQueueEntries += 1;
            if (status === 'cancelled') serviceStats.cancelledEntries += 1;
        }
    }

    const genreCount = {};
    for (const concert of concerts) {
        if (concert.genre) {
            genreCount[concert.genre] = (genreCount[concert.genre] || 0) + 1;
        }
    }

    const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

    const passDistribution = {};
    for (const user of users) {
        const passType = user.passStatus || 'None';
        passDistribution[passType] = (passDistribution[passType] || 0) + 1;
    }

    const passDistributionFormatted = Object.entries(passDistribution).map(([passType, count]) => ({
        passType,
        count,
        percentage: users.length === 0 ? '0.00' : ((count / users.length) * 100).toFixed(2),
    }));

    const monthlyRevenueTrend = Object.entries(monthlyRevenue)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, revenue]) => ({ month, revenue: Number(revenue.toFixed(2)) }));

    const usersByMonth = {};
    for (const user of users) {
        if (!user.createdAt) continue;
        const date = new Date(user.createdAt);
        if (Number.isNaN(date.getTime())) continue;
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        usersByMonth[monthKey] = (usersByMonth[monthKey] || 0) + 1;
    }

    const sortedUserGrowth = Object.entries(usersByMonth).sort((a, b) => a[0].localeCompare(b[0]));
    const userGrowth = [];
    let cumulative = 0;
    for (const [month, count] of sortedUserGrowth) {
        cumulative += count;
        userGrowth.push({ month, newUsers: count, totalUsers: cumulative });
    }

    const usersQueueHistory = users
        .map((user) => {
            const userID = Number(user.userID);
            const stats = userStatsMap.get(userID);
            const firstName = String(user.firstName || '').trim();
            const lastName = String(user.lastName || '').trim();
            const fullName = `${firstName} ${lastName}`.trim() || `User #${userID}`;
            const avgWait = stats && stats.totalQueues > 0 ? stats.totalWaitTime / stats.totalQueues : 0;
            return {
                userID,
                customerName: fullName,
                email: user.email || '',
                passStatus: user.passStatus || 'None',
                totalQueues: stats?.totalQueues || 0,
                completedQueues: stats?.completedQueues || 0,
                cancelledQueues: stats?.cancelledQueues || 0,
                activeQueues: stats?.activeQueues || 0,
                averageWaitTimeMinutes: Number(avgWait.toFixed(2)),
                lastQueuedAt: stats?.lastQueuedAt || null,
                participationHistory: (stats?.participationHistory || []).sort((a, b) =>
                    String(b.queuedAt || '').localeCompare(String(a.queuedAt || '')),
                ),
            };
        })
        .sort((a, b) => b.totalQueues - a.totalQueues || a.userID - b.userID);

    const serviceQueueActivity = concerts.map((concert) => {
        const concertID = Number(concert.concertID);
        const stats = serviceStatsMap.get(concertID) || {
            totalQueueEntries: 0,
            usersServed: 0,
            activeQueueEntries: 0,
            cancelledEntries: 0,
            totalWaitTime: 0,
            totalTicketsProcessed: 0,
            revenueFromCompleted: 0,
        };
        const averageWait = stats.totalQueueEntries > 0 ? stats.totalWaitTime / stats.totalQueueEntries : 0;
        return {
            serviceID: concertID,
            serviceName: concert.concertName,
            artistName: concert.artistName,
            genre: concert.genre,
            venue: concert.venue,
            scheduledAt: concert.date,
            totalQueueEntries: stats.totalQueueEntries,
            usersServed: stats.usersServed,
            activeQueueEntries: stats.activeQueueEntries,
            cancelledEntries: stats.cancelledEntries,
            averageWaitTimeMinutes: Number(averageWait.toFixed(2)),
            totalTicketsProcessed: stats.totalTicketsProcessed,
            revenueFromCompleted: Number(stats.revenueFromCompleted.toFixed(2)),
        };
    });

    const totalQueueEntries = history.length;
    const averageWaitTimeMinutes = totalQueueEntries > 0 ? totalWaitAcrossAll / totalQueueEntries : 0;
    const averageWaitTimeForServedMinutes = usersServed > 0
        ? history
            .filter((entry) => String(entry.status || '').toLowerCase() === 'completed')
            .reduce((sum, entry) => sum + (Number(entry.waitTime) || 0), 0) / usersServed
        : 0;

    let peakQueueHour = null;
    let peakQueueCount = 0;
    for (const [hour, count] of Object.entries(queueEntriesByHour)) {
        if (count > peakQueueCount) {
            peakQueueHour = hour;
            peakQueueCount = count;
        }
    }

    const queueUsageStatistics = {
        totalQueueEntries,
        usersServed,
        activeQueueEntries,
        cancelledEntries,
        completionRatePercent: totalQueueEntries === 0 ? 0 : Number(((usersServed / totalQueueEntries) * 100).toFixed(2)),
        averageWaitTimeMinutes: Number(averageWaitTimeMinutes.toFixed(2)),
        averageWaitTimeForServedMinutes: Number(averageWaitTimeForServedMinutes.toFixed(2)),
        totalTicketsProcessed: history.reduce((sum, entry) => sum + (Number(entry.ticketCount) || 0), 0),
        totalRevenueFromCompleted: Number(completedRevenue.toFixed(2)),
        peakQueueHourUtc: peakQueueHour,
        peakQueueHourEntryCount: peakQueueCount,
    };

    const summaryStats = {
        totalUsers: users.length,
        totalEvents: concerts.length,
        totalRevenue: Number(completedRevenue.toFixed(2)),
        averageQueueTime: `${Math.round(averageWaitTimeMinutes)} minutes`,
        topGenres,
        passDistribution: passDistributionFormatted,
        monthlyRevenueTrend,
        userGrowth,
        reportGeneratedAt: new Date().toISOString(),
    };

    const detailStats = {
        usersQueueHistory,
        serviceQueueActivity,
        queueUsageStatistics,
        allQueueHistory: allQueueHistory
            .sort((a, b) => String(b.queuedAt || '').localeCompare(String(a.queuedAt || ''))),
        recentQueueHistory: allQueueHistory
            .sort((a, b) => String(b.queuedAt || '').localeCompare(String(a.queuedAt || '')))
            .slice(0, 100),
        reportGeneratedAt: summaryStats.reportGeneratedAt,
    };

    return {
        summaryStats,
        detailStats,
    };
}

/**
 * Get all admin data report statistics
 * Returns: total users, total events, total revenue, average queue time,
 * top 5 genres, pass distribution, monthly revenue trend, and user growth stats
 */
const getDataReportStats = async (req, res) => {
    try {
        const model = getReportModel();
        sendJson(res, 200, {
            success: true,
            data: model.summaryStats,
        });

    } catch (error) {
        console.error('Error generating data report stats:', error);
        sendJson(res, 500, {
            success: false,
            error: error.message || 'Failed to generate data report'
        });
    }
};

/**
 * Get detailed admin data reports:
 * - usersQueueHistory
 * - serviceQueueActivity
 * - queueUsageStatistics
 */
const getDataReportDetails = async (req, res) => {
    try {
        const model = getReportModel();
        sendJson(res, 200, {
            success: true,
            data: model.detailStats,
        });
    } catch (error) {
        console.error('Error generating detailed data reports:', error);
        sendJson(res, 500, {
            success: false,
            error: error.message || 'Failed to generate detailed data report',
        });
    }
};

/**
 * Export report data as CSV.
 * Query param: report=users|services|queue-usage
 */
const exportDataReportCsv = async (req, res) => {
    try {
        const parsed = url.parse(req.url || '', true);
        const reportType = String(parsed.query?.report || '').toLowerCase();
        const model = getReportModel();

        let filename = 'data-report.csv';
        let csv = '';

        if (reportType === 'users') {
            filename = 'users-queue-history-report.csv';
            const rows = [];
            for (const userRow of model.detailStats.usersQueueHistory) {
                if (!Array.isArray(userRow.participationHistory) || userRow.participationHistory.length === 0) {
                    rows.push({
                        ...userRow,
                        historyID: '',
                        concertID: '',
                        concertName: '',
                        status: '',
                        inLineStatus: '',
                        ticketCount: '',
                        totalCost: '',
                        waitTimeMinutes: '',
                        queuedAt: '',
                    });
                    continue;
                }

                for (const entry of userRow.participationHistory) {
                    rows.push({
                        ...userRow,
                        historyID: entry.historyID,
                        concertID: entry.concertID,
                        concertName: entry.concertName,
                        status: entry.status,
                        inLineStatus: entry.inLineStatus,
                        ticketCount: entry.ticketCount,
                        totalCost: entry.totalCost,
                        waitTimeMinutes: entry.waitTimeMinutes,
                        queuedAt: entry.queuedAt,
                    });
                }
            }

            csv = toCsv(rows, [
                { label: 'User ID', key: 'userID' },
                { label: 'Customer Name', key: 'customerName' },
                { label: 'Email', key: 'email' },
                { label: 'Pass Status', key: 'passStatus' },
                { label: 'Total Queues', key: 'totalQueues' },
                { label: 'Completed Queues', key: 'completedQueues' },
                { label: 'Cancelled Queues', key: 'cancelledQueues' },
                { label: 'Active Queues', key: 'activeQueues' },
                { label: 'Average Wait Time (Minutes)', key: 'averageWaitTimeMinutes' },
                { label: 'Last Queued At', key: 'lastQueuedAt' },
                { label: 'History ID', key: 'historyID' },
                { label: 'Concert ID', key: 'concertID' },
                { label: 'Concert Name', key: 'concertName' },
                { label: 'Queue Status', key: 'status' },
                { label: 'In-Line Status', key: 'inLineStatus' },
                { label: 'Ticket Count', key: 'ticketCount' },
                { label: 'Total Cost', key: 'totalCost' },
                { label: 'Wait Time Minutes', key: 'waitTimeMinutes' },
                { label: 'Queued At', key: 'queuedAt' },
            ]);
        } else if (reportType === 'services') {
            filename = 'service-queue-activity-report.csv';
            csv = toCsv(model.detailStats.serviceQueueActivity, [
                { label: 'Service ID', key: 'serviceID' },
                { label: 'Service Name', key: 'serviceName' },
                { label: 'Artist Name', key: 'artistName' },
                { label: 'Genre', key: 'genre' },
                { label: 'Venue', key: 'venue' },
                { label: 'Scheduled At', key: 'scheduledAt' },
                { label: 'Total Queue Entries', key: 'totalQueueEntries' },
                { label: 'Users Served', key: 'usersServed' },
                { label: 'Active Queue Entries', key: 'activeQueueEntries' },
                { label: 'Cancelled Entries', key: 'cancelledEntries' },
                { label: 'Average Wait Time (Minutes)', key: 'averageWaitTimeMinutes' },
                { label: 'Total Tickets Processed', key: 'totalTicketsProcessed' },
                { label: 'Revenue From Completed', key: 'revenueFromCompleted' },
            ]);
        } else if (reportType === 'queue-usage') {
            filename = 'queue-usage-statistics-report.csv';
            csv = toCsv(model.detailStats.allQueueHistory, [
                { label: 'History ID', key: 'historyID' },
                { label: 'User ID', key: 'userID' },
                { label: 'Customer Name', key: 'customerName' },
                { label: 'Email', key: 'email' },
                { label: 'Concert ID', key: 'concertID' },
                { label: 'Concert Name', key: 'concertName' },
                { label: 'Genre', key: 'genre' },
                { label: 'Venue', key: 'venue' },
                { label: 'Queue Status', key: 'status' },
                { label: 'In-Line Status', key: 'inLineStatus' },
                { label: 'Ticket Count', key: 'ticketCount' },
                { label: 'Total Cost', key: 'totalCost' },
                { label: 'Wait Time Minutes', key: 'waitTimeMinutes' },
                { label: 'Queued At', key: 'queuedAt' },
            ]);
        } else {
            sendJson(res, 400, {
                success: false,
                error: 'Invalid report type. Use report=users|services|queue-usage',
            });
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        });
        res.end(csv);
    } catch (error) {
        console.error('Error exporting data report CSV:', error);
        sendJson(res, 500, {
            success: false,
            error: error.message || 'Failed to export CSV report',
        });
    }
};

module.exports = {
    getDataReportStats,
    getDataReportDetails,
    exportDataReportCsv,
};
