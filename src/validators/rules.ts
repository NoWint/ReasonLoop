import type { Validator, ValidationResult, ReasoningState, Claim } from '../core/types.js';

export interface RegexRuleValidatorConfig {
  pattern: RegExp;
  name?: string;
  confidence?: number;
}

export class RegexRuleValidator implements Validator {
  name: string;
  private pattern: RegExp;
  private confidence: number;

  constructor(config: RegexRuleValidatorConfig) {
    this.name = config.name ?? `regex:${config.pattern.source}`;
    this.pattern = config.pattern;
    this.confidence = config.confidence ?? 0.7;
  }

  async validate(_state: ReasoningState, claim?: Claim): Promise<ValidationResult> {
    const content = claim?.content ?? '';
    const passed = this.pattern.test(content);
    return {
      passed,
      evidence: passed
        ? `Claim matches pattern /${this.pattern.source}/`
        : `Claim does not match pattern /${this.pattern.source}/`,
      confidence: passed ? this.confidence : 0,
      source: 'rule',
    };
  }
}

export interface JsonSchemaRuleValidatorConfig {
  requiredFields: string[];
  name?: string;
  confidence?: number;
}

export class JsonSchemaRuleValidator implements Validator {
  name: string;
  private requiredFields: string[];
  private confidence: number;

  constructor(config: JsonSchemaRuleValidatorConfig) {
    this.name = config.name ?? `json-schema:${config.requiredFields.join(',')}`;
    this.requiredFields = config.requiredFields;
    this.confidence = config.confidence ?? 0.8;
  }

  async validate(_state: ReasoningState, claim?: Claim): Promise<ValidationResult> {
    const content = claim?.content ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        passed: false,
        evidence: 'Claim content is not valid JSON',
        details: `Failed to parse as JSON: ${content.slice(0, 100)}`,
        confidence: 0,
        source: 'rule',
      };
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        passed: false,
        evidence: 'Claim content is not a JSON object',
        confidence: 0,
        source: 'rule',
      };
    }

    const missing = this.requiredFields.filter(
      (field) => !(field in (parsed as Record<string, unknown>)),
    );

    if (missing.length > 0) {
      return {
        passed: false,
        evidence: `Missing required fields: ${missing.join(', ')}`,
        details: `Required: ${this.requiredFields.join(', ')}`,
        confidence: 0,
        source: 'rule',
      };
    }

    return {
      passed: true,
      evidence: `JSON object contains all required fields: ${this.requiredFields.join(', ')}`,
      confidence: this.confidence,
      source: 'rule',
    };
  }
}
