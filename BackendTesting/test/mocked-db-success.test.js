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
const adminConcerts  = require('../../Backend/ConcertManagement/concerts');
const adminUsers     = require('../../Backend/UserManagement/adminUsers');
const pass           = require('../../Backend/PassPurchase/updatePass');

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

// ── ConcertManagement CRUD success paths ─────────────────────────────────────

const MOCK_CONCERT_ROW = {
  concert_id: 20,
  concert_name: 'Brand New Concert',
  artist_name: 'New Artist',
  genre: 'Pop',
  event_date: '2026-08-01',
  venue: 'New Venue',
  capacity: 500,
  ticket_price: 100,
  concert_image: null,
  concert_status: 'open',
};

test('createConcert success inserts and returns new concert', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.startsWith('INSERT INTO concerts')) return [{ insertId: 20 }];
        if (sql.includes('FROM concerts') && sql.includes('LIMIT 1')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.createConcert, {
        body: {
          concertName: 'Brand New Concert',
          artistName: 'New Artist',
          genre: 'Pop',
          date: '2026-08-01',
          venue: 'New Venue',
          capacity: 500,
          ticketPrice: 100,
        },
      });
      assert.equal(result.res.statusCode, 201);
      assert.equal(result.json.success, true);
      assert.equal(result.json.concert.concertName, 'Brand New Concert');
    }
  );
});

test('editConcert success updates and returns concert', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.startsWith('UPDATE concerts SET')) return [{ affectedRows: 1 }];
        if (sql.includes('FROM concerts') && sql.includes('LIMIT 1')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(
        adminConcerts.editConcert,
        { method: 'PUT', body: { concertName: 'Brand New Concert', venue: 'New Venue' } },
        '20'
      );
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
      assert.equal(result.json.concert.concertName, 'Brand New Concert');
    }
  );
});

test('editConcert returns 404 when concert not found', async () => {
  await withMockedDb(
    {
      executeImpl: async () => [[]], // getConcertById returns empty
    },
    async () => {
      const result = await invoke(
        adminConcerts.editConcert,
        { method: 'PUT', body: { genre: 'Rock' } },
        '999'
      );
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

test('deleteConcert success removes concert and returns confirmation', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.startsWith('DELETE FROM concerts')) return [{ affectedRows: 1 }];
        if (sql.includes('FROM concerts') && sql.includes('LIMIT 1')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.deleteConcert, { method: 'DELETE' }, '20');
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
      assert.equal(result.json.concertID, 20);
    }
  );
});

test('deleteConcert returns 404 when concert not found', async () => {
  await withMockedDb(
    {
      executeImpl: async () => [[]], // getConcertById returns empty
    },
    async () => {
      const result = await invoke(adminConcerts.deleteConcert, { method: 'DELETE' }, '999');
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

// ── UserManagement CRUD success paths ────────────────────────────────────────

const MOCK_USER_ROW = {
  userID: 50,
  firstName: 'New',
  lastName: 'User',
  email: 'new@example.com',
  passStatus: 'None',
  createdAt: new Date('2026-05-01'),
  accountStatus: 'active',
  totalSpent: 0,
};

test('createUser success inserts and returns new user', async () => {
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
        if (sql.includes('SELECT 1 AS ok FROM users WHERE LOWER(TRIM(email))')) return [[]];
        if (sql.includes('FROM admins WHERE LOWER')) return [[]];
        if (sql.startsWith('INSERT INTO users')) return [{ insertId: 50 }];
        if (sql.includes('FROM users WHERE user_id = ? LIMIT 1')) return [[MOCK_USER_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminUsers.createUser, {
        body: {
          firstName: 'New',
          lastName: 'User',
          email: 'new@example.com',
          password: 'securePass123',
        },
      });
      assert.equal(result.res.statusCode, 201);
      assert.equal(result.json.success, true);
      assert.equal(result.json.user.email, 'new@example.com');
    }
  );
});

test('createUser returns 409 when email already in use', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('SELECT 1 AS ok FROM users WHERE LOWER(TRIM(email))')) return [[{ ok: 1 }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminUsers.createUser, {
        body: {
          firstName: 'Dup',
          lastName: 'User',
          email: 'taken@example.com',
          password: 'securePass123',
        },
      });
      assert.equal(result.res.statusCode, 409);
      assert.equal(result.json.success, false);
    }
  );
});

test('editUser success updates and returns user', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
          ]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ?')) return [[{ user_id: 5 }]];
        if (sql.includes('UPDATE users SET')) return [{ affectedRows: 1 }];
        if (sql.includes('FROM users WHERE user_id = ? LIMIT 1')) return [[{ ...MOCK_USER_ROW, userID: 5, firstName: 'Updated' }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(
        adminUsers.editUser,
        { method: 'PUT', body: { firstName: 'Updated', status: 'active', passType: 'gold' } },
        '5'
      );
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
    }
  );
});

test('editUser returns 404 when user not found', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ?')) return [[]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(
        adminUsers.editUser,
        { method: 'PUT', body: { firstName: 'X' } },
        '999'
      );
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

test('deleteUser success removes user', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('SELECT email FROM users WHERE user_id = ?')) return [[{ email: 'todelete@example.com' }]];
        if (sql.includes('DELETE FROM users')) return [{ affectedRows: 1 }];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminUsers.deleteUser, { method: 'DELETE' }, '8');
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
      assert.equal(result.json.userID, 8);
      assert.equal(result.json.removedEmail, 'todelete@example.com');
    }
  );
});

test('deleteUser returns 404 when user not found', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('SELECT email FROM users WHERE user_id = ?')) return [[]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminUsers.deleteUser, { method: 'DELETE' }, '999');
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

// ── PassPurchase success paths ────────────────────────────────────────────────

test('updateUserPassStatus new Gold purchase succeeds', async () => {
  let selectCallCount = 0;
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [[{ ok: 1 }]];
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT pass_status, pass_expires_at')) {
          selectCallCount++;
          if (selectCallCount === 1) return [[{ pass_status: 'None', pass_expires_at: null }]];
          return [[{ pass_status: 'Gold', pass_expires_at: new Date('2027-05-01') }]];
        }
        if (sql.includes('UPDATE users')) return [{ affectedRows: 1 }];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(pass.updateUserPassStatus, {
        body: { userID: 1, passStatus: 'Gold' },
      });
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
      assert.equal(result.json.passStatus, 'Gold');
      assert.equal(result.json.userID, 1);
    }
  );
});

test('updateUserPassStatus returns 404 when user not found', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [[{ ok: 1 }]];
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT pass_status, pass_expires_at')) return [[]]; // user not found
        return [[]];
      },
    },
    async () => {
      const result = await invoke(pass.updateUserPassStatus, {
        body: { userID: 9999, passStatus: 'Silver' },
      });
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

test('updateUserPassStatus returns 403 when removing active pass', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [[{ ok: 1 }]];
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT pass_status, pass_expires_at')) {
          // Active Gold pass expiring in the future
          return [[{ pass_status: 'Gold', pass_expires_at: new Date(Date.now() + 86400000 * 365) }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(pass.updateUserPassStatus, {
        body: { userID: 1, passStatus: 'None' },
      });
      assert.equal(result.res.statusCode, 403);
      assert.equal(result.json.success, false);
    }
  );
});

test('getAllConcerts success with mocked DB', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('FROM concerts') && sql.includes('ORDER BY concert_id ASC')) {
          return [[{
            concert_id: 10,
            concert_name: 'Mocked Concert',
            artist_name: 'Mocked Artist',
            genre: 'Jazz',
            event_date: '2026-06-01',
            venue: 'Jazz Club',
            capacity: 200,
            ticket_price: 75,
            concert_image: null,
            concert_status: 'open',
          }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.getAllConcerts, { method: 'GET' });
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
      assert.equal(result.json.count, 1);
      assert.equal(result.json.concerts[0].concertName, 'Mocked Concert');
      assert.equal(result.json.concerts[0].genre, 'Jazz');
    }
  );
});

test('getAllUsers success with mocked DB', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS') && sql.includes("TABLE_NAME = 'users'")) {
          return [[{ name: 'created_at' }, { name: 'account_status' }, { name: 'total_spent' }]];
        }
        if (sql.includes('FROM users') && sql.includes("= 'user'")) {
          return [[{
            userID: 7,
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            passStatus: 'None',
            createdAt: new Date('2026-01-15'),
            accountStatus: 'active',
            totalSpent: 50,
          }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminUsers.getAllUsers, { method: 'GET' });
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.success, true);
      assert.equal(result.json.count, 1);
      assert.equal(result.json.users[0].email, 'test@example.com');
    }
  );
});

test('listConcertsByDate returns date-ordered concerts', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('ORDER BY event_date ASC')) {
          return [[
            { concert_id: 2, concert_name: 'Early Show', artist_name: 'Artist B', genre: 'Pop',  event_date: '2026-03-01', venue: 'Venue B', capacity: 100, ticket_price: 30, concert_image: null, concert_status: 'open' },
            { concert_id: 1, concert_name: 'Late Show',  artist_name: 'Artist A', genre: 'Rock', event_date: '2026-05-01', venue: 'Venue A', capacity: 200, ticket_price: 60, concert_image: null, concert_status: 'open' },
          ]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await concertsDb.listConcertsByDate();
      assert.equal(result.length, 2);
      assert.equal(result[0].concertName, 'Early Show');
      assert.equal(result[1].concertName, 'Late Show');
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
        if (sql.includes('SELECT concert_id, concert_name FROM concerts WHERE concert_id = ? LIMIT 1')) {
          return [[{ concert_id: 1, concert_name: 'Live 1' }]];
        }
        if (sql.includes('SELECT user_id, pass_status FROM users WHERE user_id = ? LIMIT 1')) {
          return [[{ user_id: 2, pass_status: 'None' }]];
        }
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

// ── Login branch tests ───────────────────────────────────────────────────────

test('login returns 401 when user has no password hash', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) {
          return [[{ user_id: 1, email: 'u@x.com', password_hash: null, role: 'user',
                     first_name: 'A', last_name: 'B', pass_status: 'None', pass_expires_at: null }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'u@x.com', password: 'anypass' } });
      assert.equal(result.res.statusCode, 401);
      assert.equal(result.json.success, false);
    }
  );
});

test('login returns 401 when password is incorrect', async () => {
  const hash = await bcrypt.hash('correct-pass', 4);
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) {
          return [[{ user_id: 1, email: 'u@x.com', password_hash: hash, role: 'user',
                     first_name: 'A', last_name: 'B', pass_status: 'None', pass_expires_at: null }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'u@x.com', password: 'wrong-pass' } });
      assert.equal(result.res.statusCode, 401);
      assert.equal(result.json.success, false);
    }
  );
});

test('login returns 200 with active Gold pass status', async () => {
  const hash = await bcrypt.hash('pass1234', 4);
  const futureDate = new Date(Date.now() + 86400000 * 365);
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) {
          return [[{ user_id: 1, email: 'u@x.com', password_hash: hash, role: 'user',
                     first_name: 'A', last_name: 'B', pass_status: 'Gold', pass_expires_at: futureDate }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'u@x.com', password: 'pass1234' } });
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.passStatus, 'Gold');
      assert.equal(result.json.accountType, 'user');
    }
  );
});

test('login returns 404 when user not found and admin not found', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
          ]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) return [[]];
        if (sql.includes('FROM admins')) return [[]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'nobody@x.com', password: 'anypass' } });
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

test('login returns 404 when user not found and admins table missing', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[]]; // admins table not found
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) return [[]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'nobody@x.com', password: 'anypass' } });
      assert.equal(result.res.statusCode, 404);
    }
  );
});

test('login returns 200 for admin user with correct password', async () => {
  const hash = await bcrypt.hash('adminpass', 4);
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
          ]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) return [[]];
        if (sql.includes('FROM admins')) return [[{ admin_id: 5, email: 'admin@x.com', password_hash: hash }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'admin@x.com', password: 'adminpass' } });
      assert.equal(result.res.statusCode, 200);
      assert.equal(result.json.accountType, 'admin');
      assert.equal(result.json.success, true);
    }
  );
});

test('login returns 401 when admin password is incorrect', async () => {
  const hash = await bcrypt.hash('correct-admin-pass', 4);
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
          ]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) return [[]];
        if (sql.includes('FROM admins')) return [[{ admin_id: 5, email: 'admin@x.com', password_hash: hash }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'admin@x.com', password: 'wrong-admin-pass' } });
      assert.equal(result.res.statusCode, 401);
      assert.equal(result.json.success, false);
    }
  );
});

test('login returns 401 when admin has no password hash', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
          ]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('FROM users') && sql.includes('pass_status')) return [[]];
        if (sql.includes('FROM admins')) return [[{ admin_id: 5, email: 'admin@x.com', password_hash: null }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(login.handleLogin, { body: { email: 'admin@x.com', password: 'anypass' } });
      assert.equal(result.res.statusCode, 401);
      assert.equal(result.json.success, false);
    }
  );
});

// ── Signup branch tests ──────────────────────────────────────────────────────

test('signup returns 409 when email already exists in users table', async () => {
  await withMockedDb(
    {
      queryImpl: async () => [[]],
      executeImpl: async (sql) => {
        if (sql.includes('SELECT 1 AS ok FROM users')) return [[{ ok: 1 }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(signup.handleSignup, {
        body: { firstName: 'A', lastName: 'B', email: 'taken@x.com', password: 'pass1234' },
      });
      assert.equal(result.res.statusCode, 409);
      assert.equal(result.json.success, false);
    }
  );
});

test('signup returns 409 when email exists in admins table', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[{ ok: 1 }]];
        if (sql.includes('SHOW COLUMNS FROM admins')) {
          return [[
            { Field: 'admin_id', Key: 'PRI' },
            { Field: 'email', Key: '' },
            { Field: 'password_hash', Key: '' },
          ]];
        }
        if (sql.includes("INFORMATION_SCHEMA.COLUMNS") && sql.includes("TABLE_NAME = 'users'")) {
          return [[{ name: 'email' }]];
        }
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT 1 AS ok FROM users')) return [[]];
        if (sql.includes('SELECT 1 AS ok FROM admins')) return [[{ ok: 1 }]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(signup.handleSignup, {
        body: { firstName: 'A', lastName: 'B', email: 'admin@x.com', password: 'pass1234' },
      });
      assert.equal(result.res.statusCode, 409);
      assert.equal(result.json.success, false);
    }
  );
});

// ── userStats / userHistory 404 branch tests ─────────────────────────────────

test('getUserStats returns 404 when user not found', async () => {
  await withMockedDb(
    {
      poolPromiseQueryImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ? LIMIT 1')) return [[]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(userStats.getUserStats, { body: { userID: 9999 } });
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

test('getConcertHistory returns 404 when user not found', async () => {
  await withMockedDb(
    {
      poolPromiseQueryImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ? LIMIT 1')) return [[]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(userHistory.getConcertHistory, { body: { userID: 9999 } });
      assert.equal(result.res.statusCode, 404);
      assert.equal(result.json.success, false);
    }
  );
});

// ── editConcert validateEditPayload branch tests ─────────────────────────────

test('editConcert returns 400 for empty payload (validateEditPayload empty check)', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM concerts') && sql.includes('WHERE concert_id = ?')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.editConcert, { method: 'PUT', body: {} }, '1');
      assert.equal(result.res.statusCode, 400);
      assert.equal(result.json.success, false);
    }
  );
});

test('editConcert returns 400 for payload with invalid field names', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM concerts') && sql.includes('WHERE concert_id = ?')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.editConcert, {
        method: 'PUT',
        body: { unknownField: 'value' },
      }, '1');
      assert.equal(result.res.statusCode, 400);
    }
  );
});

test('editConcert returns 400 for all invalid field values', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM concerts') && sql.includes('WHERE concert_id = ?')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.editConcert, {
        method: 'PUT',
        body: {
          concertName: '',
          artistName: '',
          genre: '',
          venue: '',
          date: 'not-a-date',
          capacity: 0,
          ticketPrice: -5,
          concertImage: '',
          concertStatus: 'invalid_status',
        },
      }, '1');
      assert.equal(result.res.statusCode, 400);
      assert.ok(Array.isArray(result.json.errors) && result.json.errors.length > 0);
    }
  );
});

test('editConcert returns 400 for field values exceeding length limits', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('FROM concerts') && sql.includes('WHERE concert_id = ?')) return [[MOCK_CONCERT_ROW]];
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminConcerts.editConcert, {
        method: 'PUT',
        body: {
          concertName: 'x'.repeat(201),
          artistName: 'y'.repeat(51),
          genre: 'z'.repeat(81),
          venue: 'v'.repeat(201),
          concertImage: 'i'.repeat(501),
        },
      }, '1');
      assert.equal(result.res.statusCode, 400);
    }
  );
});

// ── adminUsers createUser with name field (tests splitName) ──────────────────

test('createUser with name field splits first and last name', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS') && sql.includes("TABLE_NAME = 'users'")) {
          return [[{ name: 'email' }, { name: 'first_name' }, { name: 'last_name' }]];
        }
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[]]; // no admins table
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT 1 AS ok FROM users WHERE LOWER(TRIM(email))')) return [[]]; // not duplicate
        if (sql.includes('INSERT INTO users')) return [{ insertId: 55 }];
        if (sql.includes('FROM users WHERE user_id = ? LIMIT 1')) {
          return [[{ userID: 55, email: 'n@x.com', firstName: 'First', lastName: 'Last',
                     passStatus: 'None', passType: 'none', accountStatus: 'active', totalSpent: 0 }]];
        }
        return [[]];
      },
    },
    async () => {
      const result = await invoke(adminUsers.createUser, {
        body: { name: 'First Last', email: 'n@x.com', password: 'pass1234' },
      });
      assert.ok([201, 200].includes(result.res.statusCode));
    }
  );
});

// ── editUser readJsonBody empty/invalid JSON via mocked DB ───────────────────

test('editUser readJsonBody resolves empty when no body sent', async () => {
  await withMockedDb(
    {
      queryImpl: async (sql) => {
        if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [[{ name: 'email' }]];
        if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [[]];
        return [[]];
      },
      executeImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ?')) return [[{ user_id: 2 }]];
        return [[]];
      },
    },
    async () => {
      // empty body → readJsonBody resolves {} → validateEditPayload empty → 400
      const result = await invoke(adminUsers.editUser, { method: 'PUT', body: null }, '2');
      assert.equal(result.res.statusCode, 400);
    }
  );
});

test('editUser returns error for invalid JSON body', async () => {
  await withMockedDb(
    {
      executeImpl: async (sql) => {
        if (sql.includes('SELECT user_id FROM users WHERE user_id = ?')) return [[{ user_id: 2 }]];
        return [[]];
      },
    },
    async () => {
      // invalid JSON → readJsonBody rejects → caught by handler
      const result = await invoke(adminUsers.editUser, { method: 'PUT', body: 'not-json{' }, '2');
      assert.ok([400, 500].includes(result.res.statusCode));
    }
  );
});
