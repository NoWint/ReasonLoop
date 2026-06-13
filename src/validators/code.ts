import type { Validator, ValidationResult, ReasoningState, Claim } from '../core/types.js';

export interface SafeEvalValidatorConfig {
  expression: string;
  name?: string;
  confidence?: number;
  timeoutMs?: number;
}

export class SafeEvalValidator implements Validator {
  name: string;
  private expression: string;
  private confidence: number;
  private timeoutMs: number;

  constructor(config: SafeEvalValidatorConfig) {
    this.name = config.name ?? `safe-eval:${config.expression.slice(0, 40)}`;
    this.expression = config.expression;
    this.confidence = config.confidence ?? 0.6;
    this.timeoutMs = config.timeoutMs ?? 5000;
  }

  async validate(state: ReasoningState, claim?: Claim): Promise<ValidationResult> {
    const context: Record<string, unknown> = {
      goal: state.goal,
      iteration: state.iteration,
      claimContent: claim?.content ?? '',
      claimConfidence: claim?.confidence ?? 0,
      claimCount: state.claims.length,
      assumptionCount: state.assumptions.length,
      evidenceCount: state.evidence.length,
      stability: state.metadata.stability,
      complexity: state.metadata.complexity,
    };

    try {
      const keys = Object.keys(context);
      const values = Object.values(context);
      const fn = new Function(...keys, `"use strict"; return (${this.expression});`);
      const result = fn(...values);

      const passed = Boolean(result);
      return {
        passed,
        evidence: passed
          ? `Expression "${this.expression}" evaluated to truthy`
          : `Expression "${this.expression}" evaluated to falsy`,
        confidence: passed ? this.confidence : 0,
        source: 'code',
      };
    } catch (err) {
      return {
        passed: false,
        evidence: `Expression evaluation failed: ${(err as Error).message}`,
        confidence: 0,
        source: 'code',
      };
    }
  }
}

export class DockerSandboxValidator implements Validator {
  name: string;
  private fallback: SafeEvalValidator;

  constructor(config: SafeEvalValidatorConfig) {
    this.name = config.name ?? `docker-sandbox:${config.expression.slice(0, 40)}`;
    this.fallback = new SafeEvalValidator(config);
  }

  async validate(state: ReasoningState, claim?: Claim): Promise<ValidationResult> {
    // Docker sandbox not yet available; fall back to SafeEvalValidator
    const result = await this.fallback.validate(state, claim);
    return {
      ...result,
      details: 'Docker sandbox unavailable; used SafeEvalValidator fallback',
    };
  }
}
