import type { ReasoningState, Decision, CompiledPrompt } from './types.js';

export function buildPlannerPrompt(state: ReasoningState, action: Decision): CompiledPrompt {
  const system = `You are a reasoning planner. Expand the analysis, propose solutions, and discover possible paths. Do NOT judge correctness — only explore.

Current task: ${action}
Iteration: ${state.iteration}
Stability: ${state.metadata.stability.toFixed(2)}

Output format:
- CLAIM: <factual assertion>
- ASSUMPTION: <unstated premise>
- EVIDENCE: <supporting data>
- QUESTION: <open question>`;

  const sections: string[] = [];
  sections.push(`## Goal\n${state.goal}`);

  if (state.claims.length > 0) {
    sections.push('## Current Claims');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content} (source: ${c.source})`));
  }
  if (state.assumptions.length > 0) {
    sections.push('## Assumptions');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
  }
  if (state.evidence.length > 0) {
    sections.push('## Evidence');
    state.evidence.forEach(e => sections.push(`- [${e.type}] ${e.content}`));
  }
  if (state.openQuestions.length > 0) {
    sections.push('## Open Questions');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
  }
  if (state.controversies.length > 0) {
    sections.push('## Controversies');
    state.controversies.forEach(c => sections.push(`- ${c.description} ${c.resolved ? '(resolved)' : '(unresolved)'}`));
  }

  const context = `Planning for iteration ${state.iteration + 1}. ${state.claims.length} claims, ${state.openQuestions.length} open questions.`;

  return { system, user: sections.join('\n\n'), context };
}
