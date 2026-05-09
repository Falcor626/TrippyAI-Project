const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.SERPAPI_PROXY_PORT || 5051);

function readEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};

  return fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return values;
      const index = trimmed.indexOf('=');
      if (index === -1) return values;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      values[key] = value;
      return values;
    }, {});
}

const envFileValues = readEnvFile();
const SERPAPI_KEY =
  process.env.SERPAPI_KEY ||
  process.env.REACT_APP_SERPAPI_KEY ||
  envFileValues.SERPAPI_KEY ||
  envFileValues.REACT_APP_SERPAPI_KEY;

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(data));
}

function proxySerpApi(request, response) {
  if (!SERPAPI_KEY) {
    sendJson(response, 500, {
      error: 'Missing SerpApi key. Add REACT_APP_SERPAPI_KEY=your_key_here to .env or set SERPAPI_KEY in your shell.',
    });
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const params = new URLSearchParams(requestUrl.searchParams);
  params.set('api_key', SERPAPI_KEY);

  if (!params.get('engine')) {
    sendJson(response, 400, { error: 'Missing required SerpApi engine parameter.' });
    return;
  }

  const serpApiUrl = `https://serpapi.com/search.json?${params.toString()}`;

  https
    .get(serpApiUrl, (serpResponse) => {
      let body = '';
      serpResponse.on('data', (chunk) => {
        body += chunk;
      });
      serpResponse.on('end', () => {
        response.writeHead(serpResponse.statusCode || 200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        response.end(body);
      });
    })
    .on('error', (error) => {
      sendJson(response, 502, { error: `SerpApi proxy request failed: ${error.message}` });
    });
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === '/health') {
    sendJson(response, 200, { ok: true, service: 'serpapi-proxy' });
    return;
  }

  if (requestUrl.pathname === '/serpapi') {
    proxySerpApi(request, response);
    return;
  }

  sendJson(response, 404, { error: 'Not found. Use /serpapi?engine=google&...' });
});

server.listen(PORT, () => {
  console.log(`SerpApi local proxy running at http://localhost:${PORT}`);
});
