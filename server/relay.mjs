// Serves the built game (dist/) and the relay from one port.
// Usage: npm run build && npm run serve   (PORT=8080 by default)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRelay } from './relay-core.mjs';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };

const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p.endsWith('/relay-info')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"relay":true}'); }
  const file = path.join(dist, path.normalize(p === '/' ? '/index.html' : p));
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
attachRelay(server);
const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`Party Game Bundle on http://localhost:${port}`));
