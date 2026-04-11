const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('../../Backend/node_modules/bcrypt');

const database = require('../../Backend/database');
const adminsAuth = require('../../Backend/db/adminsAuth');
const concertsDb = require('../../Backend/db/concertsDb');
const queue = require('../../Backend/AdminQueue/queue');
const userHistory = require('../../Backend/UserDashboard/ConcertHistory/userHistory');
const userStats = require('../../Backend/UserDashboard/UserStats/userStats');
const signup = require('../../Backend/SignUp/signup');
const login = require('../../Backend/Login/login');
const legacyConcerts = require('../../Backend/Concerts/concerts');

const { invoke } = require('./helpers/httpMocks');

function withMockedDb({ queryImpl, executeImpl, poolPromiseQueryImpl, poolQueryImpl }, fn) {
  const originalPromiseQuery = database.promisePool.query;
  const originalPromiseExecute = database.promisePool.execute;
  const originalPoolPromise = database.pool.promise;
  const originalPoolQuery = database.pool.query;

  if (queryImpl) database.promisePool.query = queryImpl;
  if (executeImpl) database.promisePool.execute = executeImpl;
  if (poolPromiseQueryImpl) {
    database.pool.promise = () => ({ query: poolPromiseQueryImpl });
  }
  if (poolQueryImpl) {
    database.pool.query = poolQueryImpl;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      database.promisePool.query = originalPromiseQuery;
      database.promisePool.execute = originalPromiseExecute;
      database.pool.promise = originalPoolPromise;
      database.pool.query = originalPoolQuery;
      adminsAuth.clearAdminsMetaCache();
    });
}

test('adminsAuth metadata and lookup work with mocked DB', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
            { Field: 'role', Key: '' },
          ]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT * FROM admins')) {
          return [[{ admin_id: 5, email: 'admin@test.com', password_hash: 'hash', role: 'admin' }]];
        }
        if (sql.includes('SELECT 1 AS ok FROM admins')) return [[{ ok: 1 }]];
        return [[]];
      },
    },
    async () => {
      const exists = await adminsAuth.tableExists('admins');
      assert.equal(exists, true);

      const found = await adminsAuth.findAdminByEmail('admin@test.com');
      assert.equal(found.admin_id, 5);
      assert.equal(found.email, 'admin@test.com');

      const taken = await adminsAuth.adminEmailTaken('admin@test.com');
      assert.equal(taken, true);
    }
  );
});

test('concertsDb CRUD adapters map rows correctly', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('FROM concerts') && sql.includes('ORDER BY concert_id ASC')) {
          return [[{
            concert_id: 1,
            concert_name: 'Live 1',
            artist_name: 'Artist 1',
            genre: 'Pop',
            event_date: '2026-01-01T00:00:00.000Z',
            venue: 'Arena',
            capacity: 100,
            ticket_price: 50,
            concert_image: 'img',
            concert_status: 'open',
          }]];
        }
        if (sql.includes('ORDER BY event_date ASC')) return [[], []];
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('WHERE concert_id = ?') && sql.includes('LIMIT 1')) {
          return [[{
            concert_id: 1,
            concert_name: 'Live 1',
            artist_name: 'Artist 1',
            genre: 'Pop',
            event_date: '2026-01-01T00:00:00.000Z',
            venue: 'Arena',
            capacity: 100,
            ticket_price: 50,
            concert_image: 'img',
            concert_status: 'open',
          }]];
        }
        if (sql.startsWith('INSERT INTO concerts')) return [{ insertId: 11 }];
        if (sql.startsWith('UPDATE concerts')) return [{ affectedRows: 1 }];
        if (sql.startsWith('DELETE FROM concerts')) return [{ affectedRows: 1 }];
        return [[]];
      },
    },
    async () => {
      const list = await concertsDb.listConcertsForAdmin();
      assert.equal(list.length, 1);
      assert.equal(list[0].concertID, 1);

      const one = await concertsDb.getConcertById(1);
      assert.equal(one.concertName, 'Live 1');

      const inserted = await concertsDb.insertConcert({
        concertName: 'C',
        artistName: 'A',
        genre: 'Pop',
        concertDate: new Date(),
        venue: 'V',
        capacity: 100,
        ticketPrice: 10,
        concertImage: 'img',
        concertStatus: 'open',
      });
      assert.equal(inserted, 11);

      const updated = await concertsDb.updateConcert(1, { concert_name: 'Updated' });
      assert.equal(updated, 1);

      const deleted = await concertsDb.deleteConcert(1);
      assert.equal(deleted, 1);
    }
  );
});

test('queue handlers success flows run with mocked DB', async () => {
  await withMockedDb(
    {
      poolPromiseQueryImpl: async (sql) => {
        if (sql.includes('SELECT qh.history_id AS queueEntryId')) {
          return [[{ queueEntryId: 10, joinedAt: new Date().toISOString(), userId: 2, concertName: 'Live 1' }]];
        }
        if (sql.includes('SELECT history_id AS queueEntryId, user_id AS userId, concert_id AS concertId')) {
          return [[{ queueEntryId: 1, userId: 2, concertId: 1, joinedAt: new Date().toISOString() }]];
        }
        if (sql.includes("UPDATE queue_history\n      SET status = 'completed'")) return [[{ affectedRows: 1 }]];
        if (sql.includes('SELECT concert_id, concert_name, artist_name, event_date, venue')) {
          return [[{ concert_id: 1, concert_name: 'Live 1', artist_name: 'Artist', event_date: new Date().toISOString(), venue: 'Arena' }]];
        }
        if (sql.includes('SELECT history_id, user_id, queued_at')) return [[{ history_id: 9, user_id: 2, queued_at: new Date().toISOString() }]];
        if (sql.includes('SELECT concert_id FROM concerts')) return [[{ concert_id: 1 }]];
        if (sql.includes('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: 2 }]];
        if (sql.includes('SELECT history_id, concert_id') && sql.includes('WHERE user_id = ?')) return [[]];
        if (sql.includes('INSERT INTO queue_history')) return [{ insertId: 33 }];
        if (sql.includes('SELECT history_id') && sql.includes('WHERE concert_id = ?')) return [[{ history_id: 20 }, { history_id: 33 }]];
        if (sql.includes('SELECT history_id, user_id, concert_id') && sql.includes('LIMIT 1')) {
          return [[{ history_id: 33, user_id: 2, concert_id: 1 }]];
        }
        if (sql.includes("SET status = 'cancelled'")) return [[{ affectedRows: 1 }]];
        if (sql.includes('LIMIT 6, 1')) return [[{ user_id: 8, concert_name: 'Live 1' }]];
        if (sql.includes('INSERT INTO notifications')) return [{ insertId: 44 }];
        if (sql.includes('SELECT notification_id, user_id, message, timestamp, status')) {
          return [[{ notification_id: 1, user_id: 8, message: 'm', timestamp: new Date().toISOString(), status: 'sent' }]];
        }
        if (sql.includes("SET status = 'viewed'")) return [[{ affectedRows: 1 }]];
        if (sql.includes('SELECT history_id, user_id, concert_id, queued_at, wait_time')) {
          return [[{ history_id: 33, user_id: 2, concert_id: 1, queued_at: new Date().toISOString(), wait_time: 5 }]];
        }
        if (sql.includes('SET status = \'completed\'')) return [[{ affectedRows: 1 }]];
        if (sql.includes('SET total_spent = COALESCE(total_spent, 0) + ?')) return [[{ affectedRows: 1 }]];
        return [[]];
      },
    },
    async () => {
      const list = await invoke(queue.getQueue, { method: 'GET' });
      assert.equal(list.res.statusCode, 200);

      const served = await invoke(queue.serveNext, { method: 'POST' });
      assert.equal(served.res.statusCode, 200);

      const status = await invoke(queue.getQueueStatusByConcert, { method: 'GET' }, '1', '2');
      assert.equal(status.res.statusCode, 200);

      const joined = await invoke(queue.joinQueue, { body: { concertId: 1, userId: 2 } });
      assert.equal(joined.res.statusCode, 201);

      const left = await invoke(queue.leaveQueue, { body: { concertId: 1, userId: 2 } });
      assert.equal(left.res.statusCode, 200);

      const paid = await invoke(queue.completePayment, {
        body: { concertId: 1, userId: 2, ticketCount: 2, totalCost: 99.5 },
      });
      assert.equal(paid.res.statusCode, 200);

      const notifs = await invoke(queue.getNotifications, { body: { userId: 8 } });
      assert.equal(notifs.res.statusCode, 200);

      const viewed = await invoke(queue.markNotificationAsViewed, { body: { notificationId: 1 } });
      assert.equal(viewed.res.statusCode, 200);
    }
  );
});

test('user history and stats success responses with mocked DB', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: 2 }]];
        if (sql.includes('FROM queue_history h') && sql.includes('JOIN concerts c')) {
          return [[{
            history_id: 9,
            user_id: 2,
            concert_id: 1,
            ticket_count: 2,
            total_cost: 100,
            wait_time: 30,
            status: 'completed',
            in_line_status: 'entered',
            queued_at: new Date().toISOString(),
            concert_name: 'Live 1',
            artist_name: 'Artist',
            genre: 'Pop',
            event_date: new Date().toISOString(),
            venue: 'Arena',
            capacity: 100,
            ticket_price: 50,
            concert_image: 'img',
            concert_status: 'open',
          }]];
        }
        if (sql.includes('COUNT(*) AS totalQueues')) return [[{ totalQueues: 1, successfulQueues: 1, totalSpending: 100 }]];
        if (sql.includes('GROUP BY c.genre')) return [[{ genre: 'Pop', frequency: 1 }]];
        if (sql.includes('GROUP BY') && sql.includes('c.concert_id')) {
          return [[{ concertID: 1, concertName: 'Live 1', artistName: 'Artist', genre: 'Pop', date: new Date().toISOString(), venue: 'Arena', capacity: 100, ticketPrice: 50, concertImage: 'img', concertStatus: 'open', queueCount: 1, totalTickets: 2, totalSpent: 100 }]];
        }
        return [[]];
      },
      poolPromiseQueryImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ? LIMIT 1')) return [[{ user_id: 2 }]];
        if (sql.includes('COUNT(*) AS totalQueues')) return [[{ totalQueues: 1, successfulQueues: 1, totalSpending: 100 }]];
        if (sql.includes('GROUP BY c.genre')) return [[{ genre: 'Pop', frequency: 1 }]];
        if (sql.includes('GROUP BY') && sql.includes('c.concert_id')) {
          return [[{ concertID: 1, concertName: 'Live 1', artistName: 'Artist', genre: 'Pop', date: new Date().toISOString(), venue: 'Arena', capacity: 100, ticketPrice: 50, concertImage: 'img', concertStatus: 'open', queueCount: 1, totalTickets: 2, totalSpent: 100 }]];
        }
        return [[]];
      },
    },
    async () => {
      const historyRes = await invoke(userHistory.getConcertHistory, { body: { userID: 2 } });
      assert.equal(historyRes.res.statusCode, 200);
      assert.equal(historyRes.json.success, true);

      const statsRes = await invoke(userStats.getUserStats, { body: { userID: 2 } });
      assert.equal(statsRes.res.statusCode, 200);
      assert.equal(statsRes.json.success, true);
    }
  );
});

test('signup/login success responses with mocked DB', async () => {
  const password = 'pass1234';
  const hash = await bcrypt.hash(password, 12);

  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[]];
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS') && sql.includes("TABLE_NAME = 'users'")) {
          return [[{ name: 'created_at' }, { name: 'updated_at' }, { name: 'role' }]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT 1 AS ok FROM users')) return [[]];
        if (sql.includes('INSERT INTO users')) return [{ insertId: 22 }];
        if (sql.includes('FROM users') && sql.includes('WHERE LOWER(TRIM(email))')) {
          return [[{ user_id: 22, email: 'unit@test.com', password_hash: hash, role: 'user', first_name: 'Unit', last_name: 'User', pass_status: 'None' }]];
        }
        return [[]];
      },
    },
    async () => {
      const signupRes = await invoke(signup.handleSignup, {
        body: { firstName: 'Unit', lastName: 'User', email: 'unit@test.com', password },
      });
      assert.equal(signupRes.res.statusCode, 201);

      const loginRes = await invoke(login.handleLogin, {
        body: { email: 'unit@test.com', password },
      });
      assert.equal(loginRes.res.statusCode, 200);
      assert.equal(loginRes.json.success, true);
    }
  );
});

test('legacy concerts handlers success with mocked callback pool.query', async () => {
  await withMockedDb(
    {
      poolQueryImpl: (sql, params, cb) => {
        if (typeof params === 'function') {
          cb = params;
        }
        const rows = [{
          concert_id: 1,
          concert_name: 'Live 1',
          artist_name: 'Artist',
          genre: 'Pop',
          event_date: new Date().toISOString(),
          venue: 'Arena',
          capacity: 100,
          ticket_price: 50,
          concert_image: 'img',
          concert_status: 'open',
          tickets_sold: 2,
        }];
        cb(null, rows);
      },
    },
    async () => {
      const list = await invoke(legacyConcerts.handleGetConcerts, { method: 'GET' });
      assert.equal(list.res.statusCode, 200);
      assert.equal(list.json.success, true);

      const one = await invoke(legacyConcerts.handleGetConcertById, { method: 'GET' }, '1');
      assert.equal(one.res.statusCode, 200);
      assert.equal(one.json.success, true);
    }
  );
});
