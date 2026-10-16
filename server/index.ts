import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { stageById } from '../shared/maps';
import { TICK_RATE } from '../shared/physics';
import { accountByToken, login, logout, myRecords, register, topRecords } from './db';
import { games, handleConnection } from './hub';

const PORT = Number(process.env.PORT ?? 8080);
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const ch of req) {
    size += ch.length;
    if (size > 10_000) throw new Error('too large');
    chunks.push(ch);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}

function bearer(req: IncomingMessage): string {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// 同じ IP からの登録・ログインの連打を抑える簡易レート制限
const attempts = new Map<string, { n: number; reset: number }>();
function limited(req: IncomingMessage): boolean {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? '';
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 1, reset: now + 60_000 }); return false; }
  a.n++;
  return a.n > 20;
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (url.pathname === '/api/health') return json(res, 200, { ok: true });
  if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
    if (limited(req)) return json(res, 429, { error: 'しばらく待ってからもう一度試してください' });
    const b = await readBody(req);
    const r = url.pathname === '/api/register'
      ? register(String(b.name ?? ''), String(b.password ?? ''))
      : login(String(b.name ?? ''), String(b.password ?? ''));
    return json(res, 'error' in r ? 400 : 200, r);
  }
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    logout(bearer(req));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/me') {
    const a = accountByToken(bearer(req));
    if (!a) return json(res, 401, { error: 'not logged in' });
    return json(res, 200, { account: a, records: myRecords(a.id) });
  }
  if (url.pathname === '/api/records') {
    const stage = url.searchParams.get('stage') ?? '';
    if (!stageById(stage)) return json(res, 404, { error: 'unknown stage' });
    return json(res, 200, { stage, records: topRecords(stage) });
  }
  return json(res, 404, { error: 'not found' });
}

async function serveStatic(res: ServerResponse, url: URL) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(STATIC_DIR, p));
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403); return res.end(); }
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error();
    const ext = extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return await serveStatic(res, url);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'server error' });
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', handleConnection);

// ゲームループ：50 tick/秒、スナップショットは 25 回/秒
let tick = 0;
const interval = 1000 / TICK_RATE;
let next = performance.now();
function loop() {
  const now = performance.now();
  let n = 0;
  while (now >= next && n < 5) {
    tick++;
    for (const g of games) g.tick(tick % 2 === 0);
    next += interval;
    n++;
  }
  if (now - next > 200) next = now;
  setTimeout(loop, Math.max(0, next - performance.now()));
}
loop();

server.listen(PORT, () => console.log(`tsunagu-run server on http://localhost:${PORT}`));
