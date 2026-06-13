import type { ReasoningState, TransitionInput, Claim, Assumption, Evidence } from './types.js';
import { computeStability } from './state.js';

export function transition(currentState: ReasoningState, input: TransitionInput, action?: string): ReasoningState {
  const { stateFragment, adversary, validatorResults } = input;
  const mergedClaims = mergeClaims(currentState.claims, stateFragment.claims ?? []);
  const mergedAssumptions = mergeAssumptions(currentState.assumptions, stateFragment.assumptions ?? [], adversary);
  const mergedEvidence = mergeEvidence(currentState.evidence, stateFragment.evidence ?? []);

  const validatorEvidence: Evidence[] = validatorResults
    .filter(r => r.passed)
    .map(r => ({
      id: `evidence-validator-${currentState.iteration + 1}`,
      content: r.evidence,
      type: 'validator_result' as const,
      source: 'validator',
      reliable: true,
      iteration: currentState.iteration + 1,
    }));

  const existingQuestions = new Set(currentState.openQuestions);
  const newQuestions = (stateFragment.openQuestions ?? []).filter(q => !existingQuestions.has(q));

  const newState: ReasoningState = {
    ...currentState,
    iteration: currentState.iteration + 1,
    claims: mergedClaims,
    assumptions: mergedAssumptions,
    evidence: [...mergedEvidence, ...validatorEvidence],
    openQuestions: [...currentState.openQuestions, ...newQuestions],
    metadata: {
      ...currentState.metadata,
      stability: 0,
      lastAction: action ?? currentState.metadata.lastAction,
      updatedAt: Date.now(),
    },
  };

  newState.metadata.stability = computeStability(newState, currentState);
  return newState;
}

function mergeClaims(existing: Claim[], incoming: Claim[]): Claim[] {
  const result = [...existing];
  for (const claim of incoming) {
    const idx = result.findIndex(c => c.content === claim.content);
    if (idx >= 0) {
      if (claim.confidence > result[idx].confidence) result[idx] = { ...result[idx], confidence: claim.confidence };
    } else {
      result.push(claim);
    }
  }
  return result;
}

function mergeAssumptions(existing: Assumption[], incoming: Assumption[], adversary: TransitionInput['adversary']): Assumption[] {
  const result = [...existing, ...incoming];
  if (adversary && adversary.issues.length > 0) {
    for (const a of result) {
      if (a.status === 'unverified') {
        a.status = 'challenged';
        a.challengedBy = adversary.issues.slice(0, 3);
      }
    }
  }
  return result;
}

function mergeEvidence(existing: Evidence[], incoming: Evidence[]): Evidence[] {
  const existingContents = new Set(existing.map(e => e.content));
  return [...existing, ...incoming.filter(e => !existingContents.has(e.content))];
}
