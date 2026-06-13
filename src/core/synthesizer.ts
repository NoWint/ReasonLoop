import type { ReasoningView, ReasoningState, Claim, Controversy, SynthesisResult } from './types.js';

function normalizeContent(content: string): string {
  return content.toLowerCase().trim();
}

function areSimilar(a: string, b: string): boolean {
  const na = normalizeContent(a);
  const nb = normalizeContent(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function areContradictory(a: string, b: string): boolean {
  const negationWords = /\b(not|no|never|cannot|can't|shouldn't|won't|don't|doesn't|isn't|aren't)\b/i;
  const na = normalizeContent(a);
  const nb = normalizeContent(b);
  const aNeg = negationWords.test(a);
  const bNeg = negationWords.test(b);
  if (aNeg !== bNeg) {
    const stripNeg = (s: string) => s.replace(/\b(not|no|never|cannot|can't|shouldn't|won't|don't|doesn't|isn't|aren't)\b\s*/gi, '').replace(/\s+/g, ' ').trim();
    const aCore = stripNeg(na);
    const bCore = stripNeg(nb);
    if (aCore === bCore || (aCore.length > 5 && bCore.length > 5 && (aCore.includes(bCore) || bCore.includes(aCore)))) {
      return true;
    }
  }
  return false;
}

export function synthesizeViews(viewResults: { view: ReasoningView; state: ReasoningState }[]): SynthesisResult {
  if (viewResults.length === 0) {
    return { consensus: [], conflicts: [], synthesized: { id: 'synthesis-empty', goal: '', iteration: 0, claims: [], assumptions: [], evidence: [], openQuestions: [], controversies: [], metadata: { stability: 1, complexity: 0, lastAction: 'synthesize', budgetRemaining: 0, totalTokensUsed: 0, createdAt: Date.now(), updatedAt: Date.now() } } };
  }

  if (viewResults.length === 1) {
    const { view, state } = viewResults[0];
    return { consensus: state.claims, conflicts: [], synthesized: { ...state, id: `synthesis-${view.id}` } };
  }

  const allClaims: { claim: Claim; viewId: string; weight: number }[] = [];
  for (const { view, state } of viewResults) {
    for (const claim of state.claims) {
      allClaims.push({ claim, viewId: view.id, weight: view.weight });
    }
  }

  // Find consensus: claims with similar content across multiple views
  const consensus: Claim[] = [];
  const matched = new Set<number>();
  for (let i = 0; i < allClaims.length; i++) {
    if (matched.has(i)) continue;
    const group: typeof allClaims = [allClaims[i]];
    for (let j = i + 1; j < allClaims.length; j++) {
      if (matched.has(j)) continue;
      if (allClaims[i].viewId !== allClaims[j].viewId && areSimilar(allClaims[i].claim.content, allClaims[j].claim.content)) {
        group.push(allClaims[j]);
        matched.add(j);
      }
    }
    if (group.length > 1) {
      matched.add(i);
      const viewCount = new Set(group.map(g => g.viewId)).size;
      const weightedConfidence = group.reduce((sum, g) => sum + g.claim.confidence * g.weight, 0) / group.reduce((sum, g) => sum + g.weight, 0);
      consensus.push({
        ...group[0].claim,
        confidence: Math.min(1, weightedConfidence * (1 + viewCount * 0.1)),
        evidence: group.flatMap(g => g.claim.evidence),
      });
    }
  }

  // Find conflicts: contradictory claims across views
  const conflicts: Controversy[] = [];
  for (let i = 0; i < allClaims.length; i++) {
    for (let j = i + 1; j < allClaims.length; j++) {
      if (allClaims[i].viewId !== allClaims[j].viewId && areContradictory(allClaims[i].claim.content, allClaims[j].claim.content)) {
        conflicts.push({
          id: `conflict-${i}-${j}`,
          description: `Conflict between ${allClaims[i].viewId} and ${allClaims[j].viewId}: "${allClaims[i].claim.content}" vs "${allClaims[j].claim.content}"`,
          positions: [allClaims[i].claim.id, allClaims[j].claim.id],
          resolved: false,
        });
      }
    }
  }

  // Synthesize: merge all states weighted by view weight
  const totalWeight = viewResults.reduce((sum, vr) => sum + vr.view.weight, 0);
  const synthesized: ReasoningState = {
    id: `synthesis-${viewResults.map(v => v.view.id).join('-')}`,
    goal: viewResults[0].state.goal,
    iteration: Math.max(...viewResults.map(vr => vr.state.iteration)),
    claims: [...consensus, ...allClaims.filter((_, i) => !matched.has(i)).map(c => c.claim)],
    assumptions: [...new Map(viewResults.flatMap(vr => vr.state.assumptions).map(a => [a.id, a])).values()],
    evidence: [...new Map(viewResults.flatMap(vr => vr.state.evidence).map(e => [e.id, e])).values()],
    openQuestions: [...new Set(viewResults.flatMap(vr => vr.state.openQuestions))],
    controversies: [...viewResults.flatMap(vr => vr.state.controversies), ...conflicts],
    metadata: {
      stability: viewResults.reduce((sum, vr) => sum + vr.state.metadata.stability * vr.view.weight, 0) / totalWeight,
      complexity: viewResults.reduce((sum, vr) => sum + vr.state.metadata.complexity * vr.view.weight, 0) / totalWeight,
      lastAction: 'synthesize',
      budgetRemaining: Math.min(...viewResults.map(vr => vr.state.metadata.budgetRemaining)),
      totalTokensUsed: viewResults.reduce((sum, vr) => sum + vr.state.metadata.totalTokensUsed, 0),
      createdAt: Math.min(...viewResults.map(vr => vr.state.metadata.createdAt)),
      updatedAt: Date.now(),
    },
  };

  return { consensus, conflicts, synthesized };
}
