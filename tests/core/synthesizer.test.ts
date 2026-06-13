import { describe, it, expect } from 'vitest';
import { synthesizeViews } from '../../src/core/synthesizer.js';
import { BUILT_IN_VIEWS } from '../../src/core/views.js';
import type { ReasoningState, ReasoningView } from '../../src/core/types.js';

function makeState(overrides: Partial<ReasoningState> = {}): ReasoningState {
  return {
    id: 'test-state',
    goal: 'Design a system',
    iteration: 1,
    claims: [],
    assumptions: [],
    evidence: [],
    openQuestions: [],
    controversies: [],
    metadata: {
      stability: 0.5,
      complexity: 0.7,
      lastAction: 'expand',
      budgetRemaining: 50000,
      totalTokensUsed: 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

describe('Synthesizer', () => {
  describe('single view', () => {
    it('should return all claims as consensus with no conflicts', () => {
      const view = BUILT_IN_VIEWS[0];
      const state = makeState({
        claims: [
          { id: 'c1', content: 'Microservices are appropriate', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const result = synthesizeViews([{ view, state }]);
      expect(result.consensus).toHaveLength(1);
      expect(result.consensus[0].content).toBe('Microservices are appropriate');
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('consensus', () => {
    it('should find consensus when multiple views have similar claims', () => {
      const view1 = BUILT_IN_VIEWS[0]; // architect
      const view2 = BUILT_IN_VIEWS[3]; // pragmatist
      const state1 = makeState({
        claims: [
          { id: 'c1', content: 'Modular architecture is needed', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const state2 = makeState({
        claims: [
          { id: 'c2', content: 'Modular architecture is needed', confidence: 0.7, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const result = synthesizeViews([
        { view: view1, state: state1 },
        { view: view2, state: state2 },
      ]);
      expect(result.consensus.length).toBeGreaterThan(0);
      expect(result.consensus[0].content).toContain('Modular architecture');
    });

    it('should boost confidence for consensus claims', () => {
      const view1 = BUILT_IN_VIEWS[0];
      const view2 = BUILT_IN_VIEWS[1];
      const state1 = makeState({
        claims: [
          { id: 'c1', content: 'Authentication is required', confidence: 0.7, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const state2 = makeState({
        claims: [
          { id: 'c2', content: 'Authentication is required', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const result = synthesizeViews([
        { view: view1, state: state1 },
        { view: view2, state: state2 },
      ]);
      expect(result.consensus[0].confidence).toBeGreaterThan(0.7);
    });
  });

  describe('conflicts', () => {
    it('should detect contradictory claims across views', () => {
      const view1 = BUILT_IN_VIEWS[0];
      const view2 = BUILT_IN_VIEWS[3];
      const state1 = makeState({
        claims: [
          { id: 'c1', content: 'Microservices are needed', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const state2 = makeState({
        claims: [
          { id: 'c2', content: 'Microservices are not needed', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 },
        ],
      });
      const result = synthesizeViews([
        { view: view1, state: state1 },
        { view: view2, state: state2 },
      ]);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].resolved).toBe(false);
    });
  });

  describe('synthesized state', () => {
    it('should merge open questions from all views', () => {
      const view1 = BUILT_IN_VIEWS[0];
      const view2 = BUILT_IN_VIEWS[1];
      const state1 = makeState({ openQuestions: ['How to deploy?'] });
      const state2 = makeState({ openQuestions: ['How to secure?'] });
      const result = synthesizeViews([
        { view: view1, state: state1 },
        { view: view2, state: state2 },
      ]);
      expect(result.synthesized.openQuestions).toContain('How to deploy?');
      expect(result.synthesized.openQuestions).toContain('How to secure?');
    });

    it('should compute weighted stability', () => {
      const view1 = BUILT_IN_VIEWS[0]; // weight 1.0
      const view2 = BUILT_IN_VIEWS[3]; // weight 0.7
      const state1 = makeState({ metadata: { ...makeState().metadata, stability: 0.8 } });
      const state2 = makeState({ metadata: { ...makeState().metadata, stability: 0.6 } });
      const result = synthesizeViews([
        { view: view1, state: state1 },
        { view: view2, state: state2 },
      ]);
      // Weighted: (0.8*1.0 + 0.6*0.7) / (1.0+0.7) = (0.8+0.42)/1.7 ≈ 0.718
      expect(result.synthesized.metadata.stability).toBeCloseTo(0.718, 1);
    });

    it('should include conflicts in synthesized controversies', () => {
      const view1 = BUILT_IN_VIEWS[0];
      const view2 = BUILT_IN_VIEWS[3];
      const state1 = makeState({
        claims: [{ id: 'c1', content: 'Scalability is critical', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }],
      });
      const state2 = makeState({
        claims: [{ id: 'c2', content: 'Scalability is not critical', confidence: 0.7, source: 'planner', evidence: [], iteration: 1 }],
      });
      const result = synthesizeViews([
        { view: view1, state: state1 },
        { view: view2, state: state2 },
      ]);
      const conflictDescs = result.synthesized.controversies.map(c => c.description);
      expect(conflictDescs.length).toBeGreaterThan(0);
    });
  });

  describe('empty input', () => {
    it('should handle empty view results', () => {
      const result = synthesizeViews([]);
      expect(result.consensus).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.synthesized.id).toBe('synthesis-empty');
    });
  });
});
