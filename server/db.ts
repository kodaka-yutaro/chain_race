import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const path = process.env.DB_PATH ?? 'data/tsunagu.db';
if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  stage_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  time REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS records_stage_time ON records(stage_id, time);
`);

export interface Account { id: number; name: string }

function hash(password: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(password, salt, 32);
  return `${salt.toString('hex')}:${h.toString('hex')}`;
}

function verify(password: string, stored: string): boolean {
  const [s, h] = stored.split(':');
  const got = scryptSync(password, Buffer.from(s, 'hex'), 32);
  return timingSafeEqual(got, Buffer.from(h, 'hex'));
}

export function validName(name: string): string | null {
  const n = name.trim();
  if (n.length < 1 || n.length > 16) return null;
  if (/[\u0000-\u001f<>]/.test(n)) return null;
  return n;
}

function newSession(accountId: number): string {
  const token = randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessions (token, account_id, created_at) VALUES (?, ?, ?)').run(token, accountId, Date.now());
  return token;
}

export function register(name: string, password: string): { token: string; account: Account } | { error: string } {
  const n = validName(name);
  if (!n) return { error: '名前は1〜16文字にしてください' };
  if (password.length < 6 || password.length > 128) return { error: 'パスワードは6文字以上にしてください' };
  const exists = db.prepare('SELECT id FROM accounts WHERE name = ?').get(n);
  if (exists) return { error: 'その名前はすでに使われています' };
  const r = db.prepare('INSERT INTO accounts (name, pass_hash, created_at) VALUES (?, ?, ?)').run(n, hash(password), Date.now());
  const id = Number(r.lastInsertRowid);
  return { token: newSession(id), account: { id, name: n } };
}

export function login(name: string, password: string): { token: string; account: Account } | { error: string } {
  const row = db.prepare('SELECT id, name, pass_hash FROM accounts WHERE name = ?').get(name.trim()) as
    | { id: number; name: string; pass_hash: string } | undefined;
  if (!row || !verify(password, row.pass_hash)) return { error: '名前かパスワードが違います' };
  return { token: newSession(row.id), account: { id: row.id, name: row.name } };
}

export function accountByToken(token: string): Account | null {
  const row = db.prepare(
    'SELECT a.id, a.name FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ?',
  ).get(token) as Account | undefined;
  return row ?? null;
}

export function logout(token: string) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** 記録を保存して、そのステージの自己ベストを返す */
export function saveRecord(accountId: number, stageId: string, mode: string, time: number): number {
  db.prepare('INSERT INTO records (account_id, stage_id, mode, time, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(accountId, stageId, mode, time, Date.now());
  const row = db.prepare('SELECT MIN(time) AS best FROM records WHERE account_id = ? AND stage_id = ?')
    .get(accountId, stageId) as { best: number };
  return row.best;
}

export function topRecords(stageId: string, limit = 20): { name: string; time: number }[] {
  return db.prepare(`
    SELECT a.name AS name, MIN(r.time) AS time FROM records r JOIN accounts a ON a.id = r.account_id
    WHERE r.stage_id = ? GROUP BY r.account_id ORDER BY time ASC LIMIT ?
  `).all(stageId, limit) as { name: string; time: number }[];
}

export function myRecords(accountId: number): { stageId: string; time: number }[] {
  return db.prepare(`
    SELECT stage_id AS stageId, MIN(time) AS time FROM records WHERE account_id = ? GROUP BY stage_id
  `).all(accountId) as { stageId: string; time: number }[];
}
