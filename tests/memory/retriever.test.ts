import { describe, it, expect } from 'vitest';
import { MemoryRetriever, formatMemoryContext } from '../../src/memory/retriever.js';
import type { VectorStore } from '../../src/memory/store.js';
import type { MemoryEntry } from '../../src/core/types.js';

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 'mem-1',
    sessionId: 's1',
    goal: 'Design a Minecraft launcher',
    claims: ['Electron is suitable'],
    lessons: ['Assumption "single developer" was challenged'],
    embedding: [1, 0, 0],
    timestamp: Date.now(),
    tags: ['minecraft', 'launcher'],
    ...overrides,
  };
}

class MockVectorStore implements VectorStore {
  private entries: MemoryEntry[] = [];

  store(entry: MemoryEntry): void {
    this.entries.push(entry);
  }

  search(query: number[], topK: number): MemoryEntry[] {
    // Simple dot-product based search for testing
    const scored = this.entries.map(entry => {
      let dot = 0;
      for (let i = 0; i < query.length && i < entry.embedding.length; i++) {
        dot += query[i] * entry.embedding[i];
      }
      return { entry, score: dot };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.entry);
  }

  close(): void {}
}

describe('Memory Retriever', () => {
  describe('MemoryRetriever', () => {
    it('should retrieve top-K memories by similarity', () => {
      const store = new MockVectorStore();
      store.store(makeEntry({ id: 'mem-1', embedding: [1, 0, 0], goal: 'Goal A' }));
      store.store(makeEntry({ id: 'mem-2', embedding: [0, 1, 0], goal: 'Goal B' }));
      store.store(makeEntry({ id: 'mem-3', embedding: [0.9, 0.1, 0], goal: 'Goal C' }));

      const retriever = new MemoryRetriever(store, 2);
      const results = retriever.retrieve([1, 0, 0]);

      expect(results).toHaveLength(2);
      expect(results[0].goal).toBe('Goal A');
      expect(results[1].goal).toBe('Goal C');
    });

    it('should return fewer results if store has fewer entries than topK', () => {
      const store = new MockVectorStore();
      store.store(makeEntry({ id: 'mem-1', embedding: [1, 0, 0] }));

      const retriever = new MemoryRetriever(store, 5);
      const results = retriever.retrieve([1, 0, 0]);
      expect(results).toHaveLength(1);
    });

    it('should return empty array when store is empty', () => {
      const store = new MockVectorStore();
      const retriever = new MemoryRetriever(store, 5);
      const results = retriever.retrieve([1, 0, 0]);
      expect(results).toHaveLength(0);
    });
  });

  describe('formatMemoryContext', () => {
    it('should format memories with claims and lessons', () => {
      const memories = [
        makeEntry({
          goal: 'Design a launcher',
          claims: ['Electron is suitable'],
          lessons: ['Assumption "single dev" was challenged'],
        }),
      ];

      const formatted = formatMemoryContext(memories);
      expect(formatted).toContain('[Historical Context]');
      expect(formatted).toContain('Goal: Design a launcher');
      expect(formatted).toContain('Electron is suitable');
      expect(formatted).toContain('Assumption "single dev" was challenged');
    });

    it('should return empty string for empty memories', () => {
      expect(formatMemoryContext([])).toBe('');
    });

    it('should skip claims section when no claims', () => {
      const memories = [
        makeEntry({ claims: [], lessons: ['Lesson A'] }),
      ];
      const formatted = formatMemoryContext(memories);
      expect(formatted).not.toContain('Claims:');
      expect(formatted).toContain('Lesson A');
    });

    it('should skip lessons section when no lessons', () => {
      const memories = [
        makeEntry({ claims: ['Claim A'], lessons: [] }),
      ];
      const formatted = formatMemoryContext(memories);
      expect(formatted).toContain('Claim A');
      expect(formatted).not.toContain('Lessons:');
    });
  });
});
