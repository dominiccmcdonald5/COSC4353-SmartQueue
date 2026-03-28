const http = require('http');
const url = require('url');
const Routes = require('./route'); 

const map_route = {
  GET: ['/api/ping', '/api/services', '/api/admin/queue', '/api/concerts'],
  POST: [
    '/api/login',
    '/api/signup',
    '/api/user/history',
    '/api/user/stats',
    '/api/user/pass/update',
    '/api/services',
    '/api/admin/queue/serve-next',
    '/api/queue/join',
  ],
  PUT: ['/api/services/', '/api/concerts/'],
  DELETE: ['/api/concerts/'],
    'GET': [
        '/api/concerts',  
        '/api/ping',
        '/api/admin/data-report'  // Added the admin route
    ],
    'POST': [
        '/api/login',
        '/api/signup',
        '/api/user/history',
        '/api/user/stats',
        '/api/user/pass/update'
    ],
    'PUT': [],
    'DELETE': [],
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

// Start Server
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