import { describe, it, expect } from 'vitest';
import { SafeEvalValidator, DockerSandboxValidator } from '../../src/validators/code.js';
import type { ReasoningState, Claim } from '../../src/core/types.js';

function makeState(claims: Claim[] = [], overrides?: Partial<ReasoningState>): ReasoningState {
  return {
    id: 'test',
    goal: 'test goal',
    iteration: 1,
    claims,
    assumptions: [],
    evidence: [],
    openQuestions: [],
    controversies: [],
    metadata: {
      stability: 0.5,
      complexity: 0.5,
      lastAction: 'expand',
      budgetRemaining: 1000,
      totalTokensUsed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

describe('SafeEvalValidator', () => {
  it('should pass when expression evaluates to truthy', async () => {
    const validator = new SafeEvalValidator({ expression: 'claimCount > 0' });
    const claim: Claim = {
      id: 'c1',
      content: 'test',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.6);
    expect(result.source).toBe('code');
  });

  it('should fail when expression evaluates to falsy', async () => {
    const validator = new SafeEvalValidator({ expression: 'claimCount > 5' });
    const claim: Claim = {
      id: 'c1',
      content: 'test',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should fail gracefully on invalid expression', async () => {
    const validator = new SafeEvalValidator({ expression: 'undefinedVar.prop' });
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('evaluation failed');
    expect(result.confidence).toBe(0);
  });

  it('should expose state fields in the expression context', async () => {
    const validator = new SafeEvalValidator({ expression: 'goal === "test goal"' });
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(true);
  });

  it('should expose claim fields when claim is provided', async () => {
    const validator = new SafeEvalValidator({ expression: 'claimConfidence >= 0.8' });
    const claim: Claim = {
      id: 'c1',
      content: 'test',
      confidence: 0.9,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
  });

  it('should use custom name and confidence', () => {
    const validator = new SafeEvalValidator({
      expression: 'true',
      name: 'my-eval',
      confidence: 0.85,
    });
    expect(validator.name).toBe('my-eval');
  });
});

describe('DockerSandboxValidator', () => {
  it('should fall back to SafeEvalValidator', async () => {
    const validator = new DockerSandboxValidator({ expression: 'claimCount >= 0' });
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(true);
    expect(result.details).toContain('SafeEvalValidator fallback');
    expect(result.source).toBe('code');
  });

  it('should fail like SafeEvalValidator on bad expression', async () => {
    const validator = new DockerSandboxValidator({ expression: 'bad.syntax.here' });
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(false);
  });
});
