import { describe, it, expect } from 'vitest';
import type {
  Claim,
  Assumption,
  Evidence,
  Controversy,
  ReasoningState,
  CriticOutput,
  Decision,
  PolicyDecision,
  ComplexityAnalysis,
  CompiledPrompt,
  ValidationResult,
  Validator,
  ConvergenceConfig,
} from '../../src/core/types.js';

describe('Core Types', () => {
  it('should construct a valid ReasoningState', () => {
    const state: ReasoningState = {
      id: 'test-1',
      goal: 'Design a system',
      iteration: 0,
      claims: [],
      assumptions: [],
      evidence: [],
      openQuestions: ['Design a system'],
      controversies: [],
      metadata: {
        stability: 0,
        complexity: 0.8,
        lastAction: 'init',
        budgetRemaining: 100000,
        totalTokensUsed: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    expect(state.metadata.complexity).toBe(0.8);
    expect(state.openQuestions).toHaveLength(1);
  });

  it('should construct a valid PolicyDecision with marginal analysis', () => {
    const decision: PolicyDecision = {
      nextAction: 'expand',
      reasoning: 'Initial exploration',
      estimatedGain: 0.8,
      estimatedCost: 0.2,
    };
    expect(decision.estimatedGain).toBeGreaterThan(decision.estimatedCost);
  });

  it('should construct a valid ComplexityAnalysis', () => {
    const analysis: ComplexityAnalysis = {
      score: 0.7,
      shouldLoop: true,
      reasoning: 'Complex design task',
    };
    expect(analysis.shouldLoop).toBe(true);
  });

  it('should construct a valid CompiledPrompt', () => {
    const prompt: CompiledPrompt = {
      system: 'You are a planner',
      user: '## Goal\nDesign a system',
      context: 'Reasoning completed in 3 iterations',
    };
    expect(prompt.system).toBeTruthy();
  });

  it('should construct a valid ValidationResult', () => {
    const result: ValidationResult = {
      passed: true,
      evidence: 'Code executed successfully',
    };
    expect(result.passed).toBe(true);
  });

  it('should define a Validator interface', () => {
    const validator: Validator = {
      name: 'test-validator',
      validate: async () => ({ passed: true, evidence: 'ok' }),
    };
    expect(validator.name).toBe('test-validator');
  });
});
