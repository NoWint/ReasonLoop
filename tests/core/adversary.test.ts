import { describe, it, expect } from 'vitest';
import { buildAdversaryPrompt, parseAdversaryOutput } from '../../src/core/adversary.js';
import { initState } from '../../src/core/state.js';

describe('Adversary Module', () => {
  it('should build adversary prompt', () => {
    let state = initState('test', 's1');
    state = { ...state, claims: [{ id: 'c1', content: 'REST is best', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
    const prompt = buildAdversaryPrompt(state);
    expect(prompt).toContain('REST is best');
    expect(prompt).toContain('attack');
  });

  it('should parse adversary output', () => {
    const response = `ISSUE: gRPC outperforms REST\nRISK: Over-fetching\nCONTRADICTION: Context-dependent\nSUGGESTION: Narrow the claim`;
    const output = parseAdversaryOutput(response);
    expect(output.issues).toHaveLength(1);
    expect(output.suggestions).toHaveLength(1);
  });
});
