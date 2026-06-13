import { describe, it, expect } from 'vitest';
import { extractMemoryFromState, extractTags } from '../../src/memory/indexer.js';
import type { ReasoningState } from '../../src/core/types.js';

function makeState(overrides: Partial<ReasoningState> = {}): ReasoningState {
  return {
    id: 'test-session',
    goal: 'Design a Minecraft launcher',
    iteration: 3,
    claims: [
      { id: 'c1', content: 'Electron is suitable for desktop apps', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 },
      { id: 'c2', content: 'Low confidence claim', confidence: 0.3, source: 'critic', evidence: [], iteration: 2 },
    ],
    assumptions: [
      { id: 'a1', content: 'Users have internet access', status: 'unverified', challengedBy: [], iteration: 1 },
      { id: 'a2', content: 'Single developer available', status: 'challenged', challengedBy: ['c1'], iteration: 2 },
      { id: 'a3', content: 'Budget is unlimited', status: 'refuted', challengedBy: ['c2'], iteration: 2 },
    ],
    evidence: [],
    openQuestions: ['What platforms to support?'],
    controversies: [],
    metadata: {
      stability: 0.8,
      complexity: 0.7,
      lastAction: 'expand',
      budgetRemaining: 500,
      totalTokensUsed: 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

describe('Memory Indexer', () => {
  describe('extractTags', () => {
    it('should extract meaningful words and remove stop words', () => {
      const tags = extractTags('Design a Minecraft launcher for the desktop');
      expect(tags).toContain('design');
      expect(tags).toContain('minecraft');
      expect(tags).toContain('launcher');
      expect(tags).toContain('desktop');
      expect(tags).not.toContain('a');
      expect(tags).not.toContain('for');
      expect(tags).not.toContain('the');
    });

    it('should filter out short words', () => {
      const tags = extractTags('I am a go to person');
      expect(tags).not.toContain('i');
      expect(tags).not.toContain('am');
      expect(tags).not.toContain('a');
      expect(tags).not.toContain('go');
      expect(tags).not.toContain('to');
    });
  });

  describe('extractMemoryFromState', () => {
    it('should extract high-confidence claims', () => {
      const state = makeState();
      const embedding = [0.1, 0.2, 0.3];
      const memory = extractMemoryFromState(state, embedding);

      expect(memory.claims).toContain('Electron is suitable for desktop apps');
      expect(memory.claims).not.toContain('Low confidence claim');
    });

    it('should extract lessons from challenged/refuted assumptions', () => {
      const state = makeState();
      const embedding = [0.1, 0.2, 0.3];
      const memory = extractMemoryFromState(state, embedding);

      expect(memory.lessons).toHaveLength(2);
      expect(memory.lessons[0]).toContain('challenged');
      expect(memory.lessons[1]).toContain('refuted');
    });

    it('should extract tags from goal', () => {
      const state = makeState();
      const embedding = [0.1, 0.2, 0.3];
      const memory = extractMemoryFromState(state, embedding);

      expect(memory.tags).toContain('design');
      expect(memory.tags).toContain('minecraft');
      expect(memory.tags).toContain('launcher');
    });

    it('should include the embedding', () => {
      const state = makeState();
      const embedding = [0.5, 0.6, 0.7];
      const memory = extractMemoryFromState(state, embedding);

      expect(memory.embedding).toEqual([0.5, 0.6, 0.7]);
    });

    it('should set sessionId to state id', () => {
      const state = makeState();
      const memory = extractMemoryFromState(state, []);
      expect(memory.sessionId).toBe('test-session');
    });

    it('should produce empty claims when all are low confidence', () => {
      const state = makeState({
        claims: [
          { id: 'c1', content: 'Low claim', confidence: 0.2, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const memory = extractMemoryFromState(state, []);
      expect(memory.claims).toHaveLength(0);
    });

    it('should produce empty lessons when no assumptions are challenged/refuted', () => {
      const state = makeState({
        assumptions: [
          { id: 'a1', content: 'Safe assumption', status: 'supported', challengedBy: [], iteration: 1 },
        ],
      });
      const memory = extractMemoryFromState(state, []);
      expect(memory.lessons).toHaveLength(0);
    });
  });
});
