import type { ReasoningState, ConvergenceConfig } from './types.js';

export function checkConvergence(state: ReasoningState, config: ConvergenceConfig): boolean {
  if (state.iteration < config.minIterations) return false;
  if (state.iteration >= config.maxIterations) return true;
  if (state.metadata.budgetRemaining <= 0) return true;
  if (state.metadata.stability >= config.stabilityThreshold) return true;
  return false;
}
