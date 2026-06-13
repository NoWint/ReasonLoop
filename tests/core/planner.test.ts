import { describe, it, expect } from 'vitest';
import { buildPlannerPrompt } from '../../src/core/planner.js';
import { initState } from '../../src/core/state.js';

describe('Planner Module', () => {
  it('should build a planner-specific prompt', () => {
    const state = initState('Design a launcher', 's1');
    const prompt = buildPlannerPrompt(state, 'expand');
    expect(prompt.system).toContain('planner');
    expect(prompt.user).toContain('Design a launcher');
  });

  it('should include current state context', () => {
    let state = initState('test', 's1');
    state = { ...state, claims: [{ id: 'c1', content: 'Claim A', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
    const prompt = buildPlannerPrompt(state, 'refine');
    expect(prompt.user).toContain('Claim A');
  });
});
