import type { ReasoningState, PolicyDecision, ConvergenceConfig } from './types.js';

function estimateGain(state: ReasoningState): number {
  const openScore = state.openQuestions.length * 0.2;
  const controversyScore = state.controversies.filter(c => !c.resolved).length * 0.15;
  const unverifiedScore = state.assumptions.filter(a => a.status === 'unverified').length * 0.1;
  return Math.min(openScore + controversyScore + unverifiedScore, 1);
}

function estimateCost(state: ReasoningState): number {
  const budgetUsedRatio = 1 - (state.metadata.budgetRemaining / 100000);
  return budgetUsedRatio * 0.5 + 0.1;
}

export function decide(state: ReasoningState, config: ConvergenceConfig): PolicyDecision {
  const { iteration, metadata, assumptions } = state;
  const { stability, budgetRemaining } = metadata;
  const gain = estimateGain(state);
  const cost = estimateCost(state);

  if (iteration >= config.maxIterations) {
    return { nextAction: 'stop', reasoning: 'Max iterations reached', estimatedGain: gain, estimatedCost: cost };
  }
  if (iteration >= config.minIterations && stability >= config.stabilityThreshold) {
    return { nextAction: 'stop', reasoning: `Stability ${stability.toFixed(2)} >= threshold`, estimatedGain: gain, estimatedCost: cost };
  }
  if (budgetRemaining <= 0) {
    return { nextAction: 'stop', reasoning: 'Budget exhausted', estimatedGain: gain, estimatedCost: cost };
  }
  if (iteration >= config.minIterations && gain < cost) {
    return { nextAction: 'stop', reasoning: `Marginal gain (${gain.toFixed(2)}) < cost (${cost.toFixed(2)})`, estimatedGain: gain, estimatedCost: cost };
  }
  if (iteration === 0) {
    return { nextAction: 'expand', reasoning: 'Initial exploration', estimatedGain: gain, estimatedCost: cost };
  }
  if (iteration >= 4 && iteration % 3 === 1 && stability < config.stabilityThreshold) {
    return { nextAction: 'attack', reasoning: `Periodic adversary check at iteration ${iteration}`, estimatedGain: gain, estimatedCost: cost };
  }
  if (assumptions.filter(a => a.status === 'unverified').length > 0 && iteration >= 2) {
    return { nextAction: 'verify', reasoning: 'Unverified assumptions need validation', estimatedGain: gain, estimatedCost: cost };
  }
  if (stability < 0.4) {
    return { nextAction: 'expand', reasoning: `Low stability (${stability.toFixed(2)})`, estimatedGain: gain, estimatedCost: cost };
  }
  return { nextAction: 'refine', reasoning: `Medium stability (${stability.toFixed(2)}), refining`, estimatedGain: gain, estimatedCost: cost };
}
