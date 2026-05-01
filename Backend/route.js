const url = require('url');
const actions = require('./simpleActions');
const login = require('./Login/login');
const signup = require('./SignUp/signup');
const userHistory = require('./UserDashboard/ConcertHistory/userHistory');
const userStats = require('./UserDashboard/UserStats/userStats');
const updatePass = require('./PassPurchase/updatePass');
// const services = require('./ServiceManagement/services');
const adminQueue = require('./AdminQueue/queue');
const concerts = require('./ConcertManagement/concerts');
const concertsLegacy = require('./Concerts/concerts');
const dataReportStats = require('./AdminDataReport/dataReportStats');
const adminUsers = require('./UserManagement/adminUsers');

function routes(req, res) {
  const parsed = url.parse(req.url || '', true);
  const pathname = parsed.pathname || '';
  const method = req.method;

  console.log(`Incoming request: ${method} ${pathname}`);

  if (pathname === '/api/ping' && method === 'GET') {
    return actions.handlePing(req, res);
  }

  if (pathname === '/api/login' && method === 'POST') {
    return login.handleLogin(req, res);
  }

  if (pathname === '/api/signup' && method === 'POST') {
    return signup.handleSignup(req, res);
  }

  if (pathname === '/api/user/history' && method === 'POST') {
    return userHistory.getConcertHistory(req, res);
  }

  if (pathname === '/api/user/stats' && method === 'POST') {
    return userStats.getUserStats(req, res);
  }

  if (pathname === '/api/user/pass/update' && method === 'POST') {
    return updatePass.updateUserPassStatus(req, res);
  }

  if (pathname === '/api/admin/data-report' && method === 'GET') {
    return dataReportStats.getDataReportStats(req, res);
  }

  if (pathname === '/api/admin/data-report/details' && method === 'GET') {
    return dataReportStats.getDataReportDetails(req, res);
  }

  if (pathname === '/api/admin/data-report/export.csv' && method === 'GET') {
    return dataReportStats.exportDataReportCsv(req, res);
  }

  /* —— Concert lookup (legacy) —— */
  if (pathname === '/api/concerts' && method === 'GET' ) {
    return concertsLegacy.handleGetConcerts(req, res);
  }

  if (/^\/api\/concerts\/\d+$/.test(pathname) && method === 'GET') {
    const concertId = pathname.split('/').pop();
    return concertsLegacy.handleGetConcertById(req, res, concertId);
  }

  /* —— Concert events admin CRUD —— */
  if (pathname === '/api/admin/concerts' && method === 'GET') {
    return concerts.getAllConcerts(req, res);
  }

  if (pathname === '/api/admin/concerts' && method === 'POST') {
    return concerts.createConcert(req, res);
  }

  if (method === 'PUT' && /^\/api\/admin\/concerts\/\d+$/.test(pathname)) {
    const concertID = pathname.split('/').pop();
    return concerts.editConcert(req, res, concertID);
  }

  if (method === 'DELETE' && /^\/api\/admin\/concerts\/\d+$/.test(pathname)) {
    const concertID = pathname.split('/').pop();
    return concerts.deleteConcert(req, res, concertID);
  }

  /* —— User management (admin) —— */
  if (pathname === '/api/admin/users' && method === 'GET') {
    return adminUsers.getAllUsers(req, res);
  }

  if (pathname === '/api/admin/users' && method === 'POST') {
    return adminUsers.createUser(req, res);
  }

  if (method === 'PUT' && /^\/api\/admin\/users\/\d+$/.test(pathname)) {
    const userID = pathname.split('/').pop();
    return adminUsers.editUser(req, res, userID);
  }

  if (method === 'DELETE' && /^\/api\/admin\/users\/\d+$/.test(pathname)) {
    const userID = pathname.split('/').pop();
    return adminUsers.deleteUser(req, res, userID);
  }

  /* —— Admin queue —— */
  if (pathname === '/api/admin/queue' && method === 'GET') {
    return adminQueue.getQueue(req, res);
  }

  if (pathname === '/api/admin/queue/serve-next' && method === 'POST') {
    return adminQueue.serveNext(req, res);
  }

  /** Optional: POST { label?, priorityLevel? } — for manual / Postman tests */
  if (pathname === '/api/queue/join' && method === 'POST') {
    return adminQueue.joinQueue(req, res);
  }

  if (pathname === '/api/queue/leave' && method === 'POST') {
    return adminQueue.leaveQueue(req, res);
  }

  if (pathname === '/api/payment/complete' && method === 'POST') {
    return adminQueue.completePayment(req, res);
  }

  /* —— Get queue status for a specific concert —— */
  if (method === 'GET' && /^\/api\/queue\/\d+$/.test(pathname)) {
    const concertId = pathname.split('/').pop();
    const userId = parsed.query.userId;
    return adminQueue.getQueueStatusByConcert(req, res, concertId, userId);
  }

  /* —— Notifications —— */
  if (pathname === '/api/notifications' && method === 'POST') {
    return adminQueue.getNotifications(req, res);
  }

  if (pathname === '/api/notifications/mark-viewed' && method === 'POST') {
    return adminQueue.markNotificationAsViewed(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route Not Found' }));
}

module.exports = routes;
