import Database from 'better-sqlite3';
import type { MemoryEntry } from '../core/types.js';
import type { VectorStore } from './store.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class SQLiteVecStore implements VectorStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        goal TEXT NOT NULL,
        claims TEXT NOT NULL,
        lessons TEXT NOT NULL,
        embedding TEXT NOT NULL,
        timestamp REAL NOT NULL,
        tags TEXT NOT NULL
      )
    `);
  }

  store(entry: MemoryEntry): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, sessionId, goal, claims, lessons, embedding, timestamp, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.id,
      entry.sessionId,
      entry.goal,
      JSON.stringify(entry.claims),
      JSON.stringify(entry.lessons),
      JSON.stringify(entry.embedding),
      entry.timestamp,
      JSON.stringify(entry.tags),
    );
  }

  search(query: number[], topK: number): MemoryEntry[] {
    const rows = this.db.prepare('SELECT * FROM memories').all() as Array<{
      id: string;
      sessionId: string;
      goal: string;
      claims: string;
      lessons: string;
      embedding: string;
      timestamp: number;
      tags: string;
    }>;

    const scored = rows.map(row => {
      const embedding = JSON.parse(row.embedding) as number[];
      return {
        entry: {
          id: row.id,
          sessionId: row.sessionId,
          goal: row.goal,
          claims: JSON.parse(row.claims) as string[],
          lessons: JSON.parse(row.lessons) as string[],
          embedding,
          timestamp: row.timestamp,
          tags: JSON.parse(row.tags) as string[],
        } satisfies MemoryEntry,
        score: cosineSimilarity(query, embedding),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.entry);
  }

  close(): void {
    this.db.close();
  }
}
