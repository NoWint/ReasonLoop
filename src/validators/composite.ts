import type { Validator, ValidationResult, ReasoningState, Claim } from '../core/types.js';

export interface CompositeValidatorConfig {
  validators: Validator[];
  name?: string;
}

export class CompositeValidator implements Validator {
  name: string;
  private validators: Validator[];

  constructor(config: CompositeValidatorConfig) {
    this.name = config.name ?? 'composite';
    this.validators = config.validators;
  }

  async validate(state: ReasoningState, claim?: Claim): Promise<ValidationResult> {
    if (this.validators.length === 0) {
      return {
        passed: true,
        evidence: 'No validators configured',
        confidence: 0,
        source: 'noop',
      };
    }

    const results = await Promise.all(
      this.validators.map((v) => v.validate(state, claim)),
    );

    // Return the result with the highest confidence
    const best = results.reduce((a, b) => (a.confidence >= b.confidence ? a : b));

    // Composite passes if ANY validator passes with confidence > 0
    const anyPassed = results.some((r) => r.passed && r.confidence > 0);
    const allDetails = results
      .map((r, i) => `[${this.validators[i].name}] passed=${r.passed} confidence=${r.confidence.toFixed(2)}`)
      .join('; ');

    return {
      passed: anyPassed,
      evidence: best.evidence,
      details: allDetails,
      confidence: best.confidence,
      source: best.source,
    };
  }
}
