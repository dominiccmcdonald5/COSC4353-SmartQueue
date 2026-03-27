const url = require('url');
const actions = require('./simpleActions');
const login = require('./Login/login');
const signup = require('./SignUp/signup');
const userHistory = require('./UserDashboard/ConcertHistory/userHistory');
const userStats = require('./UserDashboard/UserStats/userStats');
const updatePass = require('./PassPurchase/updatePass');
const services = require('./ServiceManagement/services');
const adminQueue = require('./AdminQueue/queue');
const concerts = require('./ConcertManagement/concerts');

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

  /* —— Service management (admin) —— */
  if (pathname === '/api/services' && method === 'GET') {
    return services.listServices(req, res);
  }

  if (pathname === '/api/services' && method === 'POST') {
    return services.createService(req, res);
  }

  if (method === 'PUT' && /^\/api\/services\/\d+$/.test(pathname)) {
    const serviceID = pathname.split('/').pop();
    return services.updateService(req, res, serviceID);
  }

  /* —— Concert events (admin) — same shape as mockData CONCERT —— */
  if (pathname === '/api/concerts' && method === 'GET') {
    return concerts.getAllConcerts(req, res);
  }

  if (method === 'PUT' && /^\/api\/concerts\/\d+$/.test(pathname)) {
    const concertID = pathname.split('/').pop();
    return concerts.editConcert(req, res, concertID);
  }

  if (method === 'DELETE' && /^\/api\/concerts\/\d+$/.test(pathname)) {
    const concertID = pathname.split('/').pop();
    return concerts.deleteConcert(req, res, concertID);
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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route Not Found' }));
}

module.exports = routes;
