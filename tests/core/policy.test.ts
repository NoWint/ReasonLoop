import { describe, it, expect } from 'vitest';
import { decide } from '../../src/core/policy.js';
import { initState } from '../../src/core/state.js';
import type { ConvergenceConfig } from '../../src/core/types.js';

const defaultConfig: ConvergenceConfig = { maxIterations: 10, budgetLimit: 100000, stabilityThreshold: 0.85, minIterations: 2, complexityThreshold: 0.5 };

describe('Policy Module', () => {
  it('should expand on first iteration', () => {
    const state = initState('test', 's1');
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('expand');
  });

  it('should stop at max iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 10 };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('stop');
  });

  it('should stop when stability exceeds threshold after min iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 3, metadata: { ...initState('test', 's1').metadata, stability: 0.9 } };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('stop');
  });

  it('should not stop before min iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 1, metadata: { ...initState('test', 's1').metadata, stability: 0.95 } };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).not.toBe('stop');
  });

  it('should trigger attack periodically', () => {
    const state = { ...initState('test', 's1'), iteration: 4, metadata: { ...initState('test', 's1').metadata, stability: 0.4 } };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('attack');
  });

  it('should always provide reasoning and marginal estimates', () => {
    const state = initState('test', 's1');
    const decision = decide(state, defaultConfig);
    expect(decision.reasoning).toBeTruthy();
    expect(decision.estimatedGain).toBeGreaterThanOrEqual(0);
    expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
  });
});
