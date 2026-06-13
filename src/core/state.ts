import type { Claim, Assumption, Evidence, ReasoningState } from './types.js';

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function initState(goal: string, id?: string, budget: number = 100000): ReasoningState {
  return {
    id: id ?? generateId('state'),
    goal,
    iteration: 0,
    claims: [],
    assumptions: [],
    evidence: [],
    openQuestions: [goal],
    controversies: [],
    metadata: {
      stability: 0,
      complexity: 0,
      lastAction: 'init',
      budgetRemaining: budget,
      totalTokensUsed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

export function addClaim(state: ReasoningState, claim: Omit<Claim, 'id'>): ReasoningState {
  const newClaim: Claim = { ...claim, id: generateId('claim') };
  return {
    ...state,
    claims: [...state.claims, newClaim],
  };
}

export function addAssumption(state: ReasoningState, assumption: Omit<Assumption, 'id'>): ReasoningState {
  const newAssumption: Assumption = { ...assumption, id: generateId('assumption') };
  return {
    ...state,
    assumptions: [...state.assumptions, newAssumption],
  };
}

export function addEvidence(state: ReasoningState, evidence: Omit<Evidence, 'id'>): ReasoningState {
  const newEvidence: Evidence = { ...evidence, id: generateId('evidence') };
  return {
    ...state,
    evidence: [...state.evidence, newEvidence],
  };
}

export function computeStability(prev: ReasoningState, curr: ReasoningState): number {
  const prevClaims = new Set(prev.claims.map(c => c.content));
  const currClaims = new Set(curr.claims.map(c => c.content));
  const prevAssumptions = new Set(prev.assumptions.map(a => a.content));
  const currAssumptions = new Set(curr.assumptions.map(a => a.content));

  const claimOverlap = setOverlap(prevClaims, currClaims);
  const assumptionOverlap = setOverlap(prevAssumptions, currAssumptions);

  return (claimOverlap + assumptionOverlap) / 2;
}

function setOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const item of a) {
    if (b.has(item)) overlap++;
  }
  return overlap / Math.max(a.size, b.size);
}

export interface StateDiff {
  claimsAdded: number;
  claimsRemoved: number;
  assumptionsAdded: number;
  assumptionsRemoved: number;
  evidenceAdded: number;
  evidenceRemoved: number;
}

export function diffStates(curr: ReasoningState, prev: ReasoningState): StateDiff {
  const prevClaimIds = new Set(prev.claims.map(c => c.id));
  const currClaimIds = new Set(curr.claims.map(c => c.id));
  const prevAssumptionIds = new Set(prev.assumptions.map(a => a.id));
  const currAssumptionIds = new Set(curr.assumptions.map(a => a.id));
  const prevEvidenceIds = new Set(prev.evidence.map(e => e.id));
  const currEvidenceIds = new Set(curr.evidence.map(e => e.id));

  return {
    claimsAdded: [...currClaimIds].filter(id => !prevClaimIds.has(id)).length,
    claimsRemoved: [...prevClaimIds].filter(id => !currClaimIds.has(id)).length,
    assumptionsAdded: [...currAssumptionIds].filter(id => !prevAssumptionIds.has(id)).length,
    assumptionsRemoved: [...prevAssumptionIds].filter(id => !currAssumptionIds.has(id)).length,
    evidenceAdded: [...currEvidenceIds].filter(id => !prevEvidenceIds.has(id)).length,
    evidenceRemoved: [...prevEvidenceIds].filter(id => !currEvidenceIds.has(id)).length,
  };
}
