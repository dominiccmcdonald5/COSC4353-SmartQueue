const { promisePool } = require('../database');

const USER_ROLE_FILTER = `LOWER(TRIM(COALESCE(role, 'user'))) = 'user'`;

async function getUsersColumnSet() {
  const [rows] = await promisePool.query(
    `SELECT LOWER(COLUMN_NAME) AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  );
  return new Set((rows || []).map((r) => String(r.name)));
}

function normalizePassLabel(raw) {
  if (raw == null) return 'None';
  const s = String(raw).trim();
  if (!s) return 'None';
  const low = s.toLowerCase();
  if (low === 'gold') return 'Gold';
  if (low === 'silver') return 'Silver';
  if (low === 'none') return 'None';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function fetchUserReportStats() {
  try {
    const cols = await getUsersColumnSet();
    const [[{ totalUsers }]] = await promisePool.query(
      `SELECT COUNT(*) AS totalUsers FROM users WHERE ${USER_ROLE_FILTER}`
    );
    const n = Number(totalUsers) || 0;

    const [passRows] = await promisePool.query(
      `SELECT TRIM(COALESCE(pass_status, '')) AS pass_raw, COUNT(*) AS cnt
       FROM users WHERE ${USER_ROLE_FILTER}
       GROUP BY TRIM(COALESCE(pass_status, ''))`
    );
    const passDistributionFormatted = (passRows || []).map((row) => {
      const passType = normalizePassLabel(row.pass_raw);
      const count = Number(row.cnt) || 0;
      return {
        passType,
        count,
        percentage: n > 0 ? ((count / n) * 100).toFixed(2) : '0.00',
      };
    });

    let userGrowthArray = [];
    if (cols.has('created_at')) {
      const [byMonth] = await promisePool.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS cnt
         FROM users
         WHERE ${USER_ROLE_FILTER} AND created_at IS NOT NULL
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY month ASC`
      );
      const sorted = (byMonth || []).map((r) => ({
        month: String(r.month),
        cnt: Number(r.cnt) || 0,
      }));
      let cumulative = 0;
      userGrowthArray = sorted.map(({ month, cnt }) => {
        cumulative += cnt;
        return { month, newUsers: cnt, totalUsers: cumulative };
      });
    }

    return {
      totalUsers: n,
      passDistribution: passDistributionFormatted,
      userGrowth: userGrowthArray,
    };
  } catch (e) {
    console.error('fetchUserReportStats:', e);
    return {
      totalUsers: 0,
      passDistribution: [],
      userGrowth: [],
    };
  }
}

async function fetchConcertReportStats() {
  try {
    const [[{ totalEvents }]] = await promisePool.query(`SELECT COUNT(*) AS totalEvents FROM concerts`);

    const [genreRows] = await promisePool.query(
      `SELECT genre, COUNT(*) AS cnt
       FROM concerts
       WHERE genre IS NOT NULL AND TRIM(genre) <> ''
       GROUP BY genre
       ORDER BY cnt DESC
       LIMIT 5`
    );
    const topGenres = (genreRows || []).map((r) => ({
      genre: String(r.genre),
      count: Number(r.cnt) || 0,
    }));

    return {
      totalEvents: Number(totalEvents) || 0,
      topGenres,
    };
  } catch (e) {
    console.error('fetchConcertReportStats:', e);
    return {
      totalEvents: 0,
      topGenres: [],
    };
  }
}

/**
 * Optional table queue_history (see db/schema_queue_history.sql).
 * If missing or wrong shape, returns zeros / empty trend.
 */
async function fetchHistoryReportStats() {
  let totalRevenue = 0;
  let averageQueueTime = 0;
  let monthlyRevenueArray = [];

  try {
    const [revRows] = await promisePool.query(
      `SELECT COALESCE(SUM(total_cost), 0) AS s
       FROM queue_history
       WHERE LOWER(TRIM(status)) = 'completed'`
    );
    totalRevenue = Number(revRows[0]?.s) || 0;

    const [waitRows] = await promisePool.query(`SELECT AVG(wait_time) AS w FROM queue_history`);
    averageQueueTime = Math.round(Number(waitRows[0]?.w) || 0);

    const [monthRows] = await promisePool.query(
      `SELECT DATE_FORMAT(queued_at, '%Y-%m') AS month,
              COALESCE(SUM(total_cost), 0) AS revenue
       FROM queue_history
       WHERE LOWER(TRIM(status)) = 'completed'
         AND queued_at IS NOT NULL
       GROUP BY DATE_FORMAT(queued_at, '%Y-%m')
       ORDER BY month ASC`
    );
    monthlyRevenueArray = (monthRows || []).map((r) => ({
      month: String(r.month),
      revenue: parseFloat(Number(r.revenue || 0).toFixed(2)),
    }));
  } catch {
    /* table may not exist */
  }

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    averageQueueTime: `${averageQueueTime} minutes`,
    monthlyRevenueTrend: monthlyRevenueArray,
  };
}

const getDataReportStats = async (req, res) => {
  try {
    const [userStats, concertStats, historyStats] = await Promise.all([
      fetchUserReportStats(),
      fetchConcertReportStats(),
      fetchHistoryReportStats(),
    ]);

    const reportStats = {
      totalUsers: userStats.totalUsers,
      totalEvents: concertStats.totalEvents,
      totalRevenue: historyStats.totalRevenue,
      averageQueueTime: historyStats.averageQueueTime,
      topGenres: concertStats.topGenres,
      passDistribution: userStats.passDistribution,
      monthlyRevenueTrend: historyStats.monthlyRevenueTrend,
      userGrowth: userStats.userGrowth,
      reportGeneratedAt: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          success: true,
          data: reportStats,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Error generating data report stats:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate data report',
      })
    );
  }
};

module.exports = {
  getDataReportStats,
};