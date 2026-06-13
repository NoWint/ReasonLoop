import { describe, it, expect } from 'vitest';
import { RetrievalValidator, NoopSearchProvider } from '../../src/validators/retrieval.js';
import type { SearchProvider, SearchResult } from '../../src/validators/retrieval.js';
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

class MockSearchProvider implements SearchProvider {
  constructor(private results: SearchResult[]) {}
  async search(_query: string): Promise<SearchResult[]> {
    return this.results;
  }
}

describe('NoopSearchProvider', () => {
  it('should return empty results', async () => {
    const provider = new NoopSearchProvider();
    const results = await provider.search('anything');
    expect(results).toEqual([]);
  });
});

describe('RetrievalValidator', () => {
  it('should fail when no claim is provided', async () => {
    const validator = new RetrievalValidator();
    const result = await validator.validate(makeState());
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.source).toBe('retrieval');
  });

  it('should fail when search returns no results', async () => {
    const validator = new RetrievalValidator({ provider: new NoopSearchProvider() });
    const claim: Claim = {
      id: 'c1',
      content: 'Some claim',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('No search results');
  });

  it('should pass when search returns high-relevance results', async () => {
    const provider = new MockSearchProvider([
      { snippet: 'Supporting evidence for the claim', relevance: 0.9 },
    ]);
    const validator = new RetrievalValidator({ provider, confidenceThreshold: 0.5 });
    const claim: Claim = {
      id: 'c1',
      content: 'Some claim',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.9);
    expect(result.source).toBe('retrieval');
  });

  it('should fail when search results are below threshold', async () => {
    const provider = new MockSearchProvider([
      { snippet: 'Weak evidence', relevance: 0.3 },
    ]);
    const validator = new RetrievalValidator({ provider, confidenceThreshold: 0.5 });
    const claim: Claim = {
      id: 'c1',
      content: 'Some claim',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('below threshold');
  });

  it('should pick the highest relevance result', async () => {
    const provider = new MockSearchProvider([
      { snippet: 'Low relevance', relevance: 0.2 },
      { snippet: 'High relevance', relevance: 0.8 },
      { snippet: 'Medium relevance', relevance: 0.5 },
    ]);
    const validator = new RetrievalValidator({ provider, confidenceThreshold: 0.5 });
    const claim: Claim = {
      id: 'c1',
      content: 'Some claim',
      confidence: 0.8,
      source: 'planner',
      evidence: [],
      iteration: 1,
    };
    const result = await validator.validate(makeState([claim]), claim);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.8);
  });

  it('should use default name', () => {
    const validator = new RetrievalValidator();
    expect(validator.name).toBe('retrieval');
  });

  it('should use custom name', () => {
    const validator = new RetrievalValidator({ name: 'my-retrieval' });
    expect(validator.name).toBe('my-retrieval');
  });
});
