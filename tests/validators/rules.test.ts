import { describe, it, expect } from 'vitest';
import { RegexRuleValidator, JsonSchemaRuleValidator } from '../../src/validators/rules.js';
import type { ReasoningState, Claim } from '../../src/core/types.js';

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

describe('RegexRuleValidator', () => {
  it('should pass when claim content matches the pattern', async () => {
    const validator = new RegexRuleValidator({ pattern: /hello\s+world/i });
    const claim: Claim = {
      id: 'c1',
      content: 'Hello World is a common phrase',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.7);
    expect(result.source).toBe('rule');
  });

  it('should fail when claim content does not match the pattern', async () => {
    const validator = new RegexRuleValidator({ pattern: /hello\s+world/i });
    const claim: Claim = {
      id: 'c1',
      content: 'Goodbye moon',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('rule');
  });

  it('should fail when no claim is provided', async () => {
    const validator = new RegexRuleValidator({ pattern: /test/ });
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should use custom name and confidence', async () => {
    const validator = new RegexRuleValidator({
      pattern: /test/,
      name: 'my-regex',
      confidence: 0.9,
    });
    expect(validator.name).toBe('my-regex');
    const claim: Claim = {
      id: 'c1',
      content: 'this is a test',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.confidence).toBe(0.9);
  });

  it('should auto-generate name from pattern', () => {
    const validator = new RegexRuleValidator({ pattern: /hello\s+world/i });
    expect(validator.name).toBe('regex:hello\\s+world');
  });
});

describe('JsonSchemaRuleValidator', () => {
  it('should pass when JSON has all required fields', async () => {
    const validator = new JsonSchemaRuleValidator({ requiredFields: ['name', 'age'] });
    const claim: Claim = {
      id: 'c1',
      content: '{"name": "Alice", "age": 30}',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.8);
    expect(result.source).toBe('rule');
  });

  it('should fail when JSON is missing required fields', async () => {
    const validator = new JsonSchemaRuleValidator({ requiredFields: ['name', 'age', 'email'] });
    const claim: Claim = {
      id: 'c1',
      content: '{"name": "Alice", "age": 30}',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.evidence).toContain('email');
  });

  it('should fail when content is not valid JSON', async () => {
    const validator = new JsonSchemaRuleValidator({ requiredFields: ['name'] });
    const claim: Claim = {
      id: 'c1',
      content: 'not json at all',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('not valid JSON');
  });

  it('should fail when JSON is not an object', async () => {
    const validator = new JsonSchemaRuleValidator({ requiredFields: ['name'] });
    const claim: Claim = {
      id: 'c1',
      content: '[1, 2, 3]',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('not a JSON object');
  });

  it('should use custom name and confidence', () => {
    const validator = new JsonSchemaRuleValidator({
      requiredFields: ['id'],
      name: 'has-id',
      confidence: 0.95,
    });
    expect(validator.name).toBe('has-id');
  });

  it('should auto-generate name from required fields', () => {
    const validator = new JsonSchemaRuleValidator({ requiredFields: ['a', 'b'] });
    expect(validator.name).toBe('json-schema:a,b');
  });
});
