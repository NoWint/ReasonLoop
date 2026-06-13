import type { MemoryEntry } from '../core/types.js';

export interface VectorStore {
  store(entry: MemoryEntry): void;
  search(query: number[], topK: number): MemoryEntry[];
  close(): void;
}
