import { describe, it, expect } from 'vitest';
import { compileState, compileFinalResponse } from '../../src/core/compiler.js';
import { initState } from '../../src/core/state.js';

describe('Prompt Compiler', () => {
  describe('compileState', () => {
    it('should compile state into system/user/context prompts', () => {
      const state = initState('Design a system', 's1');
      const compiled = compileState(state, 'expand', 'planner');
      expect(compiled.system).toContain('planner');
      expect(compiled.user).toContain('Design a system');
      expect(compiled.context).toBeTruthy();
    });

    it('should include claims in user prompt', () => {
      let state = initState('test', 's1');
      state = { ...state, claims: [{ id: 'c1', content: 'Claim A', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
      const compiled = compileState(state, 'refine', 'critic');
      expect(compiled.user).toContain('Claim A');
    });
  });

  describe('compileFinalResponse', () => {
    it('should compile final state into natural language', () => {
      let state = initState('Design a launcher', 's1');
      state = { ...state, claims: [{ id: 'c1', content: 'Electron is suitable', confidence: 0.85, source: 'planner', evidence: [], iteration: 1 }] };
      state = { ...state, iteration: 3, metadata: { ...state.metadata, stability: 0.87 } };
      const response = compileFinalResponse(state, [{ role: 'user', content: 'Design a launcher' }]);
      expect(response).toContain('Electron is suitable');
    });
  });
});
