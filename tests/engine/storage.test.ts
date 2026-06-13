import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { saveState, loadState, loadHistory } from '../../src/engine/storage.js';
import { initState } from '../../src/core/state.js';

describe('Storage Module', () => {
  let tmpDir: string;
  beforeAll(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-test-')); });

  it('should save and load state', async () => {
    const state = initState('test', 's1');
    await saveState(state, tmpDir);
    const loaded = await loadState(tmpDir, 0);
    expect(loaded.goal).toBe('test');
  });

  it('should load full history', async () => {
    const s0 = initState('test', 's1');
    const s1 = { ...s0, iteration: 1 };
    await saveState(s0, tmpDir);
    await saveState(s1, tmpDir);
    const history = await loadHistory(tmpDir);
    expect(history).toHaveLength(2);
  });
});
