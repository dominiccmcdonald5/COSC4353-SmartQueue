const actions = require('./simpleActions');
const login = require('./Login/login');
const signup = require('./SignUp/signup')


function routes(req, res) {
    const URL = req.url;
    const method = req.method;

    console.log(`Incoming request: ${method} ${URL}`);

    if (URL === '/api/ping' && method === 'GET') {
        return actions.handlePing(req, res);
    }

   if (URL === '/api/login' && method === 'POST') {
        return login.handleLogin(req,res);
   }

   if (URL === '/api/signup' && method === 'POST') {
       return signup.handleSignup(req, res);
   }
    
    /*if (URL.startsWith('/signup') && method === 'POST') {
        return actions.handleSignup(req, res);
    } */
    

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route Not Found" }));
};

module.exports = routes;