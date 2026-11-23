'use strict';
/* Shared helpers for the film tools: static server, Playwright/Chrome discovery. */
const fs = require('fs'), path = require('path'), http = require('http');

const FILM_DIR = path.resolve(__dirname, '../film');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, 'playwright', 'playwright-core', '/opt/playwright-mcp/node_modules/playwright-core'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  throw new Error('Playwright not found. Run `npm i` in tools/ or set PLAYWRIGHT_PATH.');
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) if (fs.existsSync(p)) return p;
  return undefined;
}

// Serves film/ over HTTP with Range support, which Chrome needs to seek inside the mp3.
function serve() {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(FILM_DIR, u.endsWith('/') ? u + 'index.html' : u);
    if (!f.startsWith(FILM_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    const size = fs.statSync(f).size, type = MIME[path.extname(f)] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
      fs.createReadStream(f, { start: a, end: b }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
      fs.createReadStream(f).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

async function launch() {
  const pw = loadPlaywright();
  return pw.chromium.launch({
    executablePath: chromePath(), headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
  });
}

module.exports = { FILM_DIR, serve, launch, chromePath };
