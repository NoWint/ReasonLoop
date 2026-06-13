import { describe, it, expect } from 'vitest';
import { checkConvergence } from '../../src/core/convergence.js';
import { initState } from '../../src/core/state.js';
import type { ConvergenceConfig } from '../../src/core/types.js';

const defaultConfig: ConvergenceConfig = { maxIterations: 10, budgetLimit: 100000, stabilityThreshold: 0.85, minIterations: 2, complexityThreshold: 0.5 };

describe('Convergence Module', () => {
  it('should not converge before min iterations', () => {
    expect(checkConvergence({ ...initState('test', 's1'), iteration: 1 }, defaultConfig)).toBe(false);
  });
  it('should converge at max iterations', () => {
    expect(checkConvergence({ ...initState('test', 's1'), iteration: 10 }, defaultConfig)).toBe(true);
  });
  it('should converge when stability exceeds threshold after min iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 3, metadata: { ...initState('test', 's1').metadata, stability: 0.9 } };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });
  it('should converge when budget exhausted', () => {
    const state = { ...initState('test', 's1'), iteration: 3, metadata: { ...initState('test', 's1').metadata, budgetRemaining: 0 } };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });
});
