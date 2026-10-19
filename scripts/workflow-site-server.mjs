// Serve only original workflow examples, not repository metadata or artifacts.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';

const root = resolve('examples/workflow');
createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new Error('method');
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/robots.txt') {
      res.end('User-agent: *\nAllow: /');
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(pathname));
    if (!path.startsWith(root + sep) || !path.endsWith('.html')) throw new Error('path');
    const body = await readFile(path);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(45812, '127.0.0.1', () => console.log('Owned workflow examples: http://127.0.0.1:45812'));
