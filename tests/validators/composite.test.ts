import { describe, it, expect } from 'vitest';
import { CompositeValidator } from '../../src/validators/composite.js';
import { RegexRuleValidator } from '../../src/validators/rules.js';
import { SafeEvalValidator } from '../../src/validators/code.js';
import type { Validator, ValidationResult, ReasoningState, Claim } from '../../src/core/types.js';

function makeState(claims: Claim[] = []): ReasoningState {
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
  };
}

describe('CompositeValidator', () => {
  it('should pass when at least one validator passes', async () => {
    const validator = new CompositeValidator({
      validators: [
        new RegexRuleValidator({ pattern: /will-not-match/ }),
        new RegexRuleValidator({ pattern: /test/ }),
      ],
    });
    const claim: Claim = {
      id: 'c1',
      content: 'this is a test',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.source).toBe('rule');
  });

  it('should fail when all validators fail', async () => {
    const validator = new CompositeValidator({
      validators: [
        new RegexRuleValidator({ pattern: /nope/ }),
        new SafeEvalValidator({ expression: 'claimCount > 100' }),
      ],
    });
    const claim: Claim = {
      id: 'c1',
      content: 'hello world',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
  });

  it('should return highest confidence result', async () => {
    const validator = new CompositeValidator({
      validators: [
        new RegexRuleValidator({ pattern: /test/, confidence: 0.5 }),
        new SafeEvalValidator({ expression: 'claimCount >= 1', confidence: 0.9 }),
      ],
    });
    const claim: Claim = {
      id: 'c1',
      content: 'test content',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.9);
  });

  it('should include details from all validators', async () => {
    const validator = new CompositeValidator({
      validators: [
        new RegexRuleValidator({ pattern: /test/, name: 'regex-1' }),
        new SafeEvalValidator({ expression: 'true', name: 'eval-1' }),
      ],
    });
    const claim: Claim = {
      id: 'c1',
      content: 'test',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.details).toContain('regex-1');
    expect(result.details).toContain('eval-1');
  });

  it('should return noop result when no validators configured', async () => {
    const validator = new CompositeValidator({ validators: [] });
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('noop');
  });

  it('should use custom name', () => {
    const validator = new CompositeValidator({
      validators: [],
      name: 'my-composite',
    });
    expect(validator.name).toBe('my-composite');
  });

  it('should use default name', () => {
    const validator = new CompositeValidator({ validators: [] });
    expect(validator.name).toBe('composite');
  });

  it('should work with a single validator', async () => {
    const validator = new CompositeValidator({
      validators: [new RegexRuleValidator({ pattern: /hello/ })],
    });
    const claim: Claim = {
      id: 'c1',
      content: 'hello world',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.7);
  });
});
