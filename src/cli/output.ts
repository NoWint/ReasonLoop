import chalk from 'chalk';
import type { ReasoningState } from '../core/types.js';

export function formatSession(state: ReasoningState): string {
  return `[${state.id}] "${state.goal}" | ${state.iteration} iterations | stability: ${state.metadata.stability.toFixed(2)} | claims: ${state.claims.length}`;
}

export function formatIteration(state: ReasoningState): string {
  const actionColors: Record<string, typeof chalk.yellow> = {
    expand: chalk.green, refine: chalk.blue, verify: chalk.magenta, attack: chalk.red, stop: chalk.gray,
  };
  const colorFn = actionColors[state.metadata.lastAction] ?? chalk.white;
  return `[Iter ${state.iteration}] ${colorFn(state.metadata.lastAction)} | stability: ${state.metadata.stability.toFixed(2)} | claims: ${state.claims.length} | questions: ${state.openQuestions.length}`;
}
