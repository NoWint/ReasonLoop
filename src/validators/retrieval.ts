import type { Validator, ValidationResult, ReasoningState, Claim } from '../core/types.js';

export interface SearchResult {
  snippet: string;
  relevance: number; // 0-1
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}

export class NoopSearchProvider implements SearchProvider {
  async search(_query: string): Promise<SearchResult[]> {
    return [];
  }
}

export interface RetrievalValidatorConfig {
  provider?: SearchProvider;
  confidenceThreshold?: number;
  name?: string;
}

export class RetrievalValidator implements Validator {
  name: string;
  private provider: SearchProvider;
  private confidenceThreshold: number;

  constructor(config: RetrievalValidatorConfig = {}) {
    this.name = config.name ?? 'retrieval';
    this.provider = config.provider ?? new NoopSearchProvider();
    this.confidenceThreshold = config.confidenceThreshold ?? 0.5;
  }

  async validate(_state: ReasoningState, claim?: Claim): Promise<ValidationResult> {
    const content = claim?.content ?? '';
    if (!content) {
      return {
        passed: false,
        evidence: 'No claim content to validate',
        confidence: 0,
        source: 'retrieval',
      };
    }

    const results = await this.provider.search(content);

    if (results.length === 0) {
      return {
        passed: false,
        evidence: 'No search results found for claim',
        confidence: 0,
        source: 'retrieval',
      };
    }

    const maxRelevance = Math.max(...results.map((r) => r.relevance));
    const passed = maxRelevance >= this.confidenceThreshold;
    const topResult = results.find((r) => r.relevance === maxRelevance)!;

    return {
      passed,
      evidence: passed
        ? `Found supporting evidence (relevance: ${maxRelevance.toFixed(2)}): ${topResult.snippet.slice(0, 100)}`
        : `Best result relevance (${maxRelevance.toFixed(2)}) below threshold (${this.confidenceThreshold})`,
      details: `Found ${results.length} result(s), max relevance: ${maxRelevance.toFixed(2)}`,
      confidence: maxRelevance,
      source: 'retrieval',
    };
  }
}
