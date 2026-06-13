import type { MemoryEntry } from '../core/types.js';
import type { VectorStore } from './store.js';

export class MemoryRetriever {
  private store: VectorStore;
  private topK: number;

  constructor(store: VectorStore, topK = 5) {
    this.store = store;
    this.topK = topK;
  }

  retrieve(queryEmbedding: number[]): MemoryEntry[] {
    return this.store.search(queryEmbedding, this.topK);
  }
}

export function formatMemoryContext(memories: MemoryEntry[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['[Historical Context]'];

  for (const mem of memories) {
    lines.push(`Goal: ${mem.goal}`);
    if (mem.claims.length > 0) {
      lines.push('  Claims:');
      for (const claim of mem.claims) {
        lines.push(`  - ${claim}`);
      }
    }
    if (mem.lessons.length > 0) {
      lines.push('  Lessons:');
      for (const lesson of mem.lessons) {
        lines.push(`  - ${lesson}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
