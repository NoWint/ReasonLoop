import type { ReasoningState, Decision, CompiledPrompt, ReasoningView, MemoryEntry } from './types.js';
import { formatMemoryContext } from '../memory/retriever.js';

const ROLE_PROMPTS: Record<string, string> = {
  planner: 'You are a reasoning planner. Expand the analysis, propose solutions, and discover possible paths. Do NOT judge correctness — only explore.',
  critic: 'You are a critical reasoning evaluator. Find logical flaws, gaps, and inconsistencies. Use ISSUE/RISK/CONTRADICTION/SUGGESTION prefixes.',
  adversary: 'You are an adversary. Actively attack and undermine the reasoning. Construct counter-examples, break assumptions, find edge cases.',
};

export function compileState(state: ReasoningState, action: Decision, role: 'planner' | 'critic' | 'adversary'): CompiledPrompt {
  const system = `${ROLE_PROMPTS[role]}

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

  const context = `Reasoning at iteration ${state.iteration}. ${state.claims.length} claims, ${state.openQuestions.length} open questions. Stability: ${state.metadata.stability.toFixed(2)}.`;

  return { system, user: sections.join('\n\n'), context };
}

export function compileFinalResponse(state: ReasoningState, _originalMessages: Array<{role: string; content: string}>): string {
  const sections: string[] = [];

  const topClaims = [...state.claims].sort((a, b) => b.confidence - a.confidence);
  if (topClaims.length > 0) {
    sections.push('### Key Findings');
    topClaims.forEach(c => sections.push(`- ${c.content} (confidence: ${c.confidence.toFixed(2)})`));
  } else if (state.rawOutputs && state.rawOutputs.length > 0) {
    // Fallback: use the last raw output as the main content when no structured claims were extracted
    sections.push('### Analysis Result');
    const lastOutput = state.rawOutputs[state.rawOutputs.length - 1];
    // Truncate if too long, but keep substantial content
    sections.push(lastOutput.length > 3000 ? lastOutput.slice(0, 3000) + '...' : lastOutput);
  }

  if (state.assumptions.length > 0) {
    sections.push('### Assumptions');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
  }

  if (state.openQuestions.length > 0) {
    // Filter out the original goal question if it's still there
    const filteredQuestions = state.openQuestions.filter(q => q !== state.goal);
    if (filteredQuestions.length > 0) {
      sections.push('### Remaining Questions');
      filteredQuestions.forEach(q => sections.push(`- ${q}`));
    }
  }

  if (state.controversies.some(c => !c.resolved)) {
    sections.push('### Open Controversies');
    state.controversies.filter(c => !c.resolved).forEach(c => sections.push(`- ${c.description}`));
  }

  if (sections.length === 0) {
    sections.push('### Analysis Complete');
    sections.push('The reasoning process completed but did not produce structured findings. The original question may need to be rephrased.');
  }

  return sections.join('\n\n');
}

export function compileStateForView(state: ReasoningState, action: Decision, view: ReasoningView): CompiledPrompt {
  const focusAreasText = view.focusAreas.map(f => `- ${f}`).join('\n');

  const system = `${view.systemPrompt}

You are reasoning from the perspective: ${view.name}

Current task: ${action}
Iteration: ${state.iteration}
Stability: ${state.metadata.stability.toFixed(2)}

Focus areas:
${focusAreasText}

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

  const context = `View: ${view.name} (${view.id}). Reasoning at iteration ${state.iteration}. ${state.claims.length} claims, ${state.openQuestions.length} open questions. Stability: ${state.metadata.stability.toFixed(2)}.`;

  return { system, user: sections.join('\n\n'), context };
}

export function compileStateWithMemory(
  state: ReasoningState,
  action: Decision,
  role: 'planner' | 'critic' | 'adversary',
  memories: MemoryEntry[],
): CompiledPrompt {
  const compiled = compileState(state, action, role);
  const memoryContext = formatMemoryContext(memories);
  if (!memoryContext) return compiled;
  return {
    system: compiled.system,
    user: `${memoryContext}\n\n${compiled.user}`,
    context: compiled.context,
  };
}
