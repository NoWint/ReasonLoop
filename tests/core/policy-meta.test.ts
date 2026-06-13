import { describe, it, expect, vi } from 'vitest';
import { MetaReasoningPolicy } from '../../src/core/policy-meta.js';
import { PolicyController, HeuristicPolicy } from '../../src/core/policy.js';
import { initState } from '../../src/core/state.js';
import type { ConvergenceConfig } from '../../src/core/types.js';
import type { ModelAdapter, AdapterOptions, AdapterResponse } from '../../src/engine/adapter.js';

const defaultConfig: ConvergenceConfig = { maxIterations: 10, budgetLimit: 100000, stabilityThreshold: 0.85, minIterations: 2, complexityThreshold: 0.5 };

function createMockAdapter(responseContent: string): ModelAdapter {
  return {
    name: 'mock',
    complete: vi.fn(async (_prompt: string, _options: AdapterOptions): Promise<AdapterResponse> => ({
      content: responseContent,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })),
    forward: vi.fn(async () => ({})),
  };
}

describe('MetaReasoningPolicy', () => {
  it('should return a valid PolicyDecision from LLM response', async () => {
    const adapter = createMockAdapter('expand');
    const policy = new MetaReasoningPolicy(adapter, 'test-model');
    const state = initState('test goal', 's1');
    const decision = await policy.decide(state, defaultConfig);

    expect(['expand', 'refine', 'verify', 'attack', 'stop']).toContain(decision.nextAction);
    expect(decision.reasoning).toBeTruthy();
    expect(decision.nextAction).toBe('expand');
  });

  it('should parse "refine" from LLM response', async () => {
    const adapter = createMockAdapter('I think we should refine the current approach');
    const policy = new MetaReasoningPolicy(adapter, 'test-model');
    const state = initState('test goal', 's1');
    const decision = await policy.decide(state, defaultConfig);

    expect(decision.nextAction).toBe('refine');
  });

  it('should default to refine when response is unparseable', async () => {
    const adapter = createMockAdapter('maybe we could do something different');
    const policy = new MetaReasoningPolicy(adapter, 'test-model');
    const state = initState('test goal', 's1');
    const decision = await policy.decide(state, defaultConfig);

    expect(decision.nextAction).toBe('refine');
  });

  it('should build a prompt containing key state info', () => {
    const adapter = createMockAdapter('stop');
    const policy = new MetaReasoningPolicy(adapter, 'test-model');
    const state = initState('design a launcher', 's1');
    const prompt = policy.buildPrompt(state, defaultConfig);

    expect(prompt).toContain('design a launcher');
    expect(prompt).toContain('Iteration:');
    expect(prompt).toContain('Stability:');
    expect(prompt).toContain('Budget remaining:');
    expect(prompt).toContain('Claims:');
    expect(prompt).toContain('Open questions:');
    expect(prompt).toContain('Controversies:');
  });

  it('should limit maxTokens to 500', async () => {
    const adapter = createMockAdapter('stop');
    const policy = new MetaReasoningPolicy(adapter, 'test-model');
    const state = initState('test goal', 's1');
    await policy.decide(state, defaultConfig);

    expect(adapter.complete).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxTokens: 500 }),
    );
  });
});

describe('HeuristicPolicy', () => {
  it('should delegate to the decide function', async () => {
    const policy = new HeuristicPolicy();
    const state = initState('test', 's1');
    const decision = await policy.decide(state, defaultConfig);
    expect(decision.nextAction).toBe('expand');
  });
});

describe('PolicyController', () => {
  it('should use heuristic policy when iteration < 3 and no controversies', async () => {
    const adapter = createMockAdapter('expand');
    const controller = new PolicyController(adapter, 'test-model');
    const state = initState('test', 's1');
    // iteration 0, no controversies → heuristic
    const decision = await controller.decide(state, defaultConfig);
    expect(decision.nextAction).toBe('expand');
    // Heuristic should NOT have called the adapter
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it('should use meta-reasoning policy when iteration >= 3', async () => {
    const adapter = createMockAdapter('verify');
    const controller = new PolicyController(adapter, 'test-model');
    const state = { ...initState('test', 's1'), iteration: 3 };
    const decision = await controller.decide(state, defaultConfig);
    expect(decision.nextAction).toBe('verify');
    expect(adapter.complete).toHaveBeenCalled();
  });

  it('should use meta-reasoning policy when controversies exist', async () => {
    const adapter = createMockAdapter('attack');
    const controller = new PolicyController(adapter, 'test-model');
    const state = {
      ...initState('test', 's1'),
      iteration: 1,
      controversies: [{ id: 'c1', description: 'dispute', positions: [], resolved: false }],
    };
    const decision = await controller.decide(state, defaultConfig);
    expect(decision.nextAction).toBe('attack');
    expect(adapter.complete).toHaveBeenCalled();
  });

  it('should use heuristic when no adapter is provided', async () => {
    const controller = new PolicyController();
    const state = { ...initState('test', 's1'), iteration: 5 };
    const decision = await controller.decide(state, defaultConfig);
    // Even at high iteration, no adapter means heuristic only
    expect(decision.reasoning).not.toContain('meta-reasoning');
  });
});
