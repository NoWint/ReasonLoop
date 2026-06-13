import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { Storage, SessionRecord, SessionMeta, IterationRecord } from './storage.js';

export class SQLiteStorage implements Storage {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        state TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
      CREATE TABLE IF NOT EXISTS iterations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_iterations_session ON iterations(session_id);
    `);
  }

  async saveSession(session: SessionRecord): Promise<void> {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO sessions (id, goal, state, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        goal = excluded.goal, state = excluded.state,
        status = excluded.status, updated_at = excluded.updated_at
    `).run(session.id, session.state.goal, JSON.stringify(session.state), session.status, now, now);
  }

  async loadSession(id: string): Promise<SessionRecord | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { id: row.id, state: JSON.parse(row.state), status: row.status };
  }

  async listSessions(): Promise<SessionMeta[]> {
    const rows = this.db.prepare('SELECT id, goal, status, created_at FROM sessions ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({ id: r.id, goal: r.goal, status: r.status, iteration: 0, createdAt: r.created_at }));
  }

  async saveIteration(iteration: IterationRecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO iterations (id, session_id, phase, input, output, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(iteration.id, iteration.sessionId, iteration.phase, iteration.input, iteration.output, iteration.durationMs, Date.now());
  }

  async loadIterations(sessionId: string): Promise<IterationRecord[]> {
    const rows = this.db.prepare('SELECT * FROM iterations WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];
    return rows.map(r => ({
      id: r.id, sessionId: r.session_id, phase: r.phase,
      input: r.input, output: r.output, durationMs: r.duration_ms,
    }));
  }

  close(): void {
    this.db.close();
  }
}
