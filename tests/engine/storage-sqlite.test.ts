import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStorage } from '../../src/engine/storage-sqlite.js';
import { initState } from '../../src/core/state.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-sqlite-test-'));
    const dbPath = path.join(tmpDir, 'test.db');
    storage = new SQLiteStorage(dbPath);
  });

  afterEach(async () => {
    storage.close();
    try { await fs.rm(tmpDir, { recursive: true }); } catch { /* ignore */ }
  });

  it('should save and load a session', async () => {
    const state = initState('test goal', 'sess-1', 100000);
    await storage.saveSession({ id: 'sess-1', state, status: 'active' });
    const loaded = await storage.loadSession('sess-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.state.goal).toBe('test goal');
    expect(loaded!.status).toBe('active');
  });

  it('should return null for non-existent session', async () => {
    const loaded = await storage.loadSession('nonexistent');
    expect(loaded).toBeNull();
  });

  it('should list sessions', async () => {
    const state1 = initState('goal 1', 'sess-1', 100000);
    const state2 = initState('goal 2', 'sess-2', 100000);
    await storage.saveSession({ id: 'sess-1', state: state1, status: 'active' });
    await storage.saveSession({ id: 'sess-2', state: state2, status: 'completed' });
    const list = await storage.listSessions();
    expect(list).toHaveLength(2);
    const ids = list.map(s => s.id).sort();
    expect(ids).toEqual(['sess-1', 'sess-2']);
  });

  it('should save and load iterations', async () => {
    const state = initState('test goal', 'sess-1', 100000);
    await storage.saveSession({ id: 'sess-1', state, status: 'active' });
    await storage.saveIteration({
      id: 'iter-1', sessionId: 'sess-1', phase: 'planner',
      input: '{}', output: '{}', durationMs: 100,
    });
    const iterations = await storage.loadIterations('sess-1');
    expect(iterations).toHaveLength(1);
    expect(iterations[0].phase).toBe('planner');
    expect(iterations[0].durationMs).toBe(100);
  });

  it('should return empty array for iterations of non-existent session', async () => {
    const iterations = await storage.loadIterations('nonexistent');
    expect(iterations).toHaveLength(0);
  });

  it('should update session on re-save', async () => {
    const state = initState('initial goal', 'sess-1', 100000);
    await storage.saveSession({ id: 'sess-1', state, status: 'active' });
    const updatedState = { ...state, goal: 'updated goal' };
    await storage.saveSession({ id: 'sess-1', state: updatedState, status: 'completed' });
    const loaded = await storage.loadSession('sess-1');
    expect(loaded!.state.goal).toBe('updated goal');
    expect(loaded!.status).toBe('completed');
  });
});
