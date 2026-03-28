const { EventEmitter } = require('events');

function createReq({ body, method = 'GET', url = '/' } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;

  const bodyText = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  process.nextTick(() => {
    if (bodyText.length > 0) {
      req.emit('data', Buffer.from(bodyText));
    }
    req.emit('end');
  });

  return req;
}

function createRes() {
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  return {
    statusCode: null,
    headers: {},
    body: '',
    done,
    writeHead(code, headers = {}) {
      this.statusCode = code;
      this.headers = headers;
      return this;
    },
    end(chunk = '') {
      this.body += chunk;
      resolveDone();
      return this;
    },
  };
}

async function invoke(handler, { body, method = 'POST', url = '/' } = {}, ...extraArgs) {
  const req = createReq({ body, method, url });
  const res = createRes();
  const maybePromise = handler(req, res, ...extraArgs);
  await Promise.all([res.done, Promise.resolve(maybePromise)]);

  let json = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    json = null;
  }

  return { req, res, json };
}

module.exports = { createReq, createRes, invoke };
