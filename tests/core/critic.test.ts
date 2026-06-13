import { describe, it, expect } from 'vitest';
import { buildCriticPrompt, parseCriticOutput } from '../../src/core/critic.js';
import { initState } from '../../src/core/state.js';

describe('Critic Module', () => {
  it('should build critic prompt with claims', () => {
    let state = initState('test', 's1');
    state = { ...state, claims: [{ id: 'c1', content: 'Claim A', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
    const prompt = buildCriticPrompt(state);
    expect(prompt).toContain('Claim A');
  });

  it('should parse critic output', () => {
    const response = `ISSUE: Overgeneralization\nRISK: Premature adoption\nCONTRADICTION: Conflicting claims\nSUGGESTION: Qualify the claim`;
    const output = parseCriticOutput(response);
    expect(output.issues).toHaveLength(1);
    expect(output.risks).toHaveLength(1);
    expect(output.contradictions).toHaveLength(1);
    expect(output.suggestions).toHaveLength(1);
  });

  it('should handle empty response', () => {
    const output = parseCriticOutput('');
    expect(output.issues).toHaveLength(0);
  });
});
