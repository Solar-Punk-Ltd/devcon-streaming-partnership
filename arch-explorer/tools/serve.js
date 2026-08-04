/**
 * Development server. Native ES modules need a real origin, so opening
 * index.html from the filesystem will not work.
 *
 * Node's own http module only, no dependencies: this project deliberately
 * carries none, so nothing here needs a provenance check before it runs.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;

  // Resolve, then confirm the result is still inside the project. Without the
  // second half, "/../.." walks straight out of the served directory.
  const base = ROOT.endsWith(sep) ? ROOT : ROOT + sep;

  try {
    // decodeURIComponent throws on a malformed escape, and outside this block
    // that rejection is unhandled and takes the whole server down.
    const target = join(ROOT, normalize(decodeURIComponent(requested)));
    if (!target.startsWith(base)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target)] || 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`arch-explorer dev server on http://127.0.0.1:${PORT}`);
});
