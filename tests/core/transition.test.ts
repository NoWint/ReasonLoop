import { describe, it, expect } from 'vitest';
import { transition } from '../../src/core/transition.js';
import { initState } from '../../src/core/state.js';
import type { TransitionInput } from '../../src/core/types.js';

describe('Transition Module', () => {
  it('should increment iteration', () => {
    const state = initState('test', 's1');
    const input: TransitionInput = {
      scratchpad: '', stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
      critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
      adversary: null, validatorResults: [],
    };
    const newState = transition(state, input);
    expect(newState.iteration).toBe(1);
  });

  it('should merge claims and deduplicate', () => {
    const state = { ...initState('test', 's1'), claims: [{ id: 'c0', content: 'Same', confidence: 0.6, source: 'planner', evidence: [], iteration: 0 }] };
    const input: TransitionInput = {
      scratchpad: '',
      stateFragment: { claims: [{ id: 'c1', content: 'Same', confidence: 0.8, source: 'critic', evidence: [], iteration: 1 }], assumptions: [], evidence: [], openQuestions: [] },
      critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
      adversary: null, validatorResults: [],
    };
    const newState = transition(state, input);
    expect(newState.claims).toHaveLength(1);
    expect(newState.claims[0].confidence).toBe(0.8);
  });

  it('should mark assumptions as challenged when adversary finds issues', () => {
    const state = { ...initState('test', 's1'), assumptions: [{ id: 'a1', content: 'Test', status: 'unverified', challengedBy: [], iteration: 0 }] };
    const input: TransitionInput = {
      scratchpad: '', stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
      critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
      adversary: { issues: ['Counter-example'], risks: [], contradictions: [], suggestions: [] },
      validatorResults: [],
    };
    const newState = transition(state, input);
    expect(newState.assumptions[0].status).toBe('challenged');
  });
});
