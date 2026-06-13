import fs from 'node:fs/promises';
import path from 'node:path';
import type { ReasoningState } from '../core/types.js';

export interface SessionRecord {
  id: string;
  state: ReasoningState;
  status: 'active' | 'completed' | 'failed';
}

export interface SessionMeta {
  id: string;
  goal: string;
  status: string;
  iteration: number;
  createdAt: number;
}

export interface IterationRecord {
  id: string;
  sessionId: string;
  phase: string;
  input: string;
  output: string;
  durationMs: number;
}

export interface Storage {
  saveSession(session: SessionRecord): Promise<void>;
  loadSession(id: string): Promise<SessionRecord | null>;
  listSessions(): Promise<SessionMeta[]>;
  saveIteration(iteration: IterationRecord): Promise<void>;
  loadIterations(sessionId: string): Promise<IterationRecord[]>;
  close(): void;
}

export async function saveState(state: ReasoningState, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `state-${String(state.iteration).padStart(4, '0')}.json`);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function loadState(outputDir: string, iteration: number): Promise<ReasoningState> {
  const filePath = path.join(outputDir, `state-${String(iteration).padStart(4, '0')}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as ReasoningState;
}

export async function loadHistory(outputDir: string): Promise<ReasoningState[]> {
  try {
    const files = (await fs.readdir(outputDir)).filter(f => f.startsWith('state-') && f.endsWith('.json')).sort();
    const states: ReasoningState[] = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(outputDir, file), 'utf-8');
      states.push(JSON.parse(content) as ReasoningState);
    }
    return states;
  } catch { return []; }
}
