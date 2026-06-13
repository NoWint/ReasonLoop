import { describe, it, expect } from 'vitest';
import { buildScratchpadPrompt, extractStateFragment } from '../../src/core/scratchpad.js';
import { initState } from '../../src/core/state.js';

describe('Scratchpad Module', () => {
  describe('buildScratchpadPrompt', () => {
    it('should include the goal and action', () => {
      const state = initState('Design a system', 's1');
      const prompt = buildScratchpadPrompt(state, 'expand');
      expect(prompt).toContain('Design a system');
      expect(prompt).toContain('expand');
    });

    it('should include existing claims', () => {
      let state = initState('test', 's1');
      state = { ...state, claims: [{ id: 'c1', content: 'Existing claim', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 }] };
      const prompt = buildScratchpadPrompt(state, 'refine');
      expect(prompt).toContain('Existing claim');
    });
  });

  describe('extractStateFragment', () => {
    it('should extract claims, assumptions, evidence, questions', () => {
      const text = `CLAIM: Microservices are suitable\nASSUMPTION: Team has DevOps experience\nEVIDENCE: 60% adoption rate\nQUESTION: What is the expected traffic?`;
      const fragment = extractStateFragment(text, 1);
      expect(fragment.claims.length).toBeGreaterThanOrEqual(1);
      expect(fragment.assumptions.length).toBeGreaterThanOrEqual(1);
      expect(fragment.evidence.length).toBeGreaterThanOrEqual(1);
      expect(fragment.openQuestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty text', () => {
      const fragment = extractStateFragment('', 1);
      expect(fragment.claims).toHaveLength(0);
    });

    it('should assign correct iteration', () => {
      const fragment = extractStateFragment('CLAIM: Test', 3);
      expect(fragment.claims[0]?.iteration).toBe(3);
    });
  });
});
