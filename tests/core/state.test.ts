import { describe, it, expect } from 'vitest';
import { initState, addClaim, addAssumption, addEvidence, computeStability, diffStates } from '../../src/core/state.js';
import type { Claim, Assumption, Evidence } from '../../src/core/types.js';

describe('State Module', () => {
  describe('initState', () => {
    it('should create initial state with goal as open question', () => {
      const state = initState('Design a microservices system', 'session-1');
      expect(state.id).toBe('session-1');
      expect(state.goal).toBe('Design a microservices system');
      expect(state.openQuestions).toEqual(['Design a microservices system']);
      expect(state.iteration).toBe(0);
      expect(state.metadata.stability).toBe(0);
      expect(state.metadata.budgetRemaining).toBeGreaterThan(0);
    });
  });

  describe('addClaim', () => {
    it('should add a claim with generated id', () => {
      const state = initState('test', 's1');
      const claim: Omit<Claim, 'id'> = {
        content: 'Test claim',
        confidence: 0.8,
        source: 'planner',
        evidence: [],
        iteration: 1,
      };
      const newState = addClaim(state, claim);
      expect(newState.claims).toHaveLength(1);
      expect(newState.claims[0].id).toMatch(/^claim-/);
    });

    it('should not mutate original state', () => {
      const state = initState('test', 's1');
      addClaim(state, { content: 'Test', confidence: 0.5, source: 'planner', evidence: [], iteration: 1 });
      expect(state.claims).toHaveLength(0);
    });
  });

  describe('addAssumption', () => {
    it('should add an assumption', () => {
      const state = initState('test', 's1');
      const assumption: Omit<Assumption, 'id'> = {
        content: 'Team has experience',
        status: 'unverified',
        challengedBy: [],
        iteration: 1,
      };
      const newState = addAssumption(state, assumption);
      expect(newState.assumptions).toHaveLength(1);
    });
  });

  describe('addEvidence', () => {
    it('should add evidence', () => {
      const state = initState('test', 's1');
      const evidence: Omit<Evidence, 'id'> = {
        content: 'Survey data',
        type: 'empirical',
        source: 'planner',
        reliable: true,
        iteration: 1,
      };
      const newState = addEvidence(state, evidence);
      expect(newState.evidence).toHaveLength(1);
    });
  });

  describe('computeStability', () => {
    it('should return 1 for identical states', () => {
      const state = initState('test', 's1');
      expect(computeStability(state, state)).toBe(1);
    });

    it('should return lower stability when claims change', () => {
      const prev = initState('test', 's1');
      let curr = initState('test', 's1');
      curr = addClaim(curr, { content: 'New claim 1', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 });
      curr = addClaim(curr, { content: 'New claim 2', confidence: 0.7, source: 'planner', evidence: [], iteration: 1 });
      expect(computeStability(curr, prev)).toBeLessThan(1);
    });
  });

  describe('diffStates', () => {
    it('should report added and removed claims', () => {
      let prev = initState('test', 's1');
      prev = addClaim(prev, { content: 'Old claim', confidence: 0.5, source: 'planner', evidence: [], iteration: 0 });
      let curr = initState('test', 's1');
      curr = addClaim(curr, { content: 'New claim', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 });
      const diff = diffStates(curr, prev);
      expect(diff.claimsAdded).toBe(1);
      expect(diff.claimsRemoved).toBe(1);
    });
  });
});
