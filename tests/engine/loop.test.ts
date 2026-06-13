import { describe, it, expect, vi } from 'vitest';
import { runLoop } from '../../src/engine/loop.js';
import type { ModelAdapter, AdapterResponse } from '../../src/engine/adapter.js';
import type { ServerConfig } from '../../src/core/types.js';

function createMockAdapter(responses: string[]): ModelAdapter {
  let idx = 0;
  return {
    name: 'mock',
    complete: vi.fn(async (): Promise<AdapterResponse> => ({
      content: responses[idx++ % responses.length] ?? '',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    })),
    forward: vi.fn(async () => ({})),
  };
}

describe('Engine Loop', () => {
  it('should run loop and converge', async () => {
    // Each iteration now needs: scratchpad response + planner response + critic response
    // Iteration 1: scratchpad, planner, critic
    // Iteration 2: scratchpad, planner, critic
    const adapter = createMockAdapter([
      'Maybe microservices? Or monolith? Let me think...',           // scratchpad iter 1
      'CLAIM: Test claim\nASSUMPTION: Test assumption\nQUESTION: What next?',  // planner iter 1
      'ISSUE: No evidence\nSUGGESTION: Add evidence',                // critic iter 1
      'Could also consider serverless...',                            // scratchpad iter 2
      'CLAIM: Test claim\nEVIDENCE: Supporting data',                // planner iter 2
      'ISSUE: Still needs validation\nSUGGESTION: Verify',           // critic iter 2
    ]);
    const config: ServerConfig = {
      port: 8080, provider: 'openai', model: 'test', apiKey: 'test',
      maxIterations: 3, budget: 100000, stabilityThreshold: 0.85, minIterations: 2,
      complexityThreshold: 0.5, outputDir: '/tmp/rl-loop-test', loopTimeoutMs: 60000,
    };
    const result = await runLoop('Test problem', 'session-1', config, adapter);
    expect(result.finalState.iteration).toBeGreaterThanOrEqual(2);
    expect(result.history.length).toBeGreaterThanOrEqual(2);
  });
});
