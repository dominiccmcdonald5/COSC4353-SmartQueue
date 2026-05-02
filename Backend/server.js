const http = require('http');
const url = require('url');
const Routes = require('./route');

const map_route = {
  GET: [
    '/api/ping',
    // '/api/services',
    '/api/admin/queue',
    '/api/concerts',
    '/api/queue/',
    '/api/admin/data-report',
    '/api/admin/concerts',
    '/api/admin/users',
  ],
  POST: [
    '/api/login',
    '/api/signup',
    '/api/user/history',
    '/api/user/stats',
    '/api/user/pass/update',
    // '/api/services',
    '/api/admin/queue/serve-next',
    '/api/queue/join',
    '/api/queue/leave',
    '/api/payment/complete',
    '/api/admin/concerts',
    '/api/admin/users',
  ],
  PUT: [
    //'/api/services/', 
    '/api/admin/concerts/', '/api/admin/users/', '/api/admin/queue/reorder'],
  DELETE: ['/api/admin/concerts/', '/api/admin/users/', '/api/admin/queue/'],
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;
  const method = req.method;
  console.log(`Requested Path: ${pathname}, Method: ${method}`);

  if (pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify("From backend side"));
      return;
  }

  const isMatch = (map_route[method] || []).some(route =>
    pathname.startsWith(route)
  );

  console.log(`Route match: ${isMatch}`);

  if (isMatch) {
    return Routes(req, res);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route Not Found" }));
});

// Port Configuration
const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other process or set PORT in .env, e.g. PORT=5001`
    );
    console.error('Windows: netstat -ano | findstr :' + PORT + '  then  taskkill /PID <pid> /F');
    process.exit(1);
  }
  throw err;
});

// Gracefully close the DB pool when the process exits so connections are released
// on the MySQL server immediately rather than waiting for wait_timeout to expire.
const { pool } = require('./database');
function gracefulShutdown(signal) {
  console.log(`${signal} received – closing DB pool and HTTP server...`);
  server.close(() => {
    pool.end(err => {
      if (err) console.error('Error closing DB pool:', err.message);
      else console.log('DB pool closed cleanly.');
      process.exit(0);
    });
  });
  // Force-exit after 8 s if something hangs
  setTimeout(() => { process.exit(1); }, 8000).unref();
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /api/concerts`);
  console.log(`  GET  /api/admin/data-report`);
  console.log(`  POST /api/login`);
  console.log(`  POST /api/signup`);
  console.log(`  POST /api/user/history`);
  console.log(`  POST /api/user/stats`);
  console.log(`  POST /api/user/pass/update`);
});