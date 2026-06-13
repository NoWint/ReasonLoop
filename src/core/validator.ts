import type { Validator, ValidationResult, ReasoningState } from './types.js';

export const noopValidator: Validator = {
  name: 'noop',
  async validate(_state: ReasoningState): Promise<ValidationResult> {
    return { passed: true, evidence: 'No validation performed (MVP)' };
  },
};
