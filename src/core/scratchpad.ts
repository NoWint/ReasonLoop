import type { ReasoningState, Claim, Assumption, Evidence, Decision } from './types.js';

export function buildScratchpadPrompt(state: ReasoningState, action: Decision): string {
  const sections: string[] = [];
  sections.push(`## Current Task: ${action}`);
  sections.push('');

  if (state.openQuestions.length > 0) {
    sections.push('## Open Questions');
    state.openQuestions.forEach((q, i) => sections.push(`${i + 1}. ${q}`));
    sections.push('');
  }

  if (state.claims.length > 0) {
    sections.push('## Existing Claims');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }

  if (state.assumptions.length > 0) {
    sections.push('## Current Assumptions');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
    sections.push('');
  }

  if (state.evidence.length > 0) {
    sections.push('## Available Evidence');
    state.evidence.forEach(e => sections.push(`- [${e.type}] ${e.content}`));
    sections.push('');
  }

  sections.push('## Free Exploration Space');
    sections.push('Think freely and divergently. Explore, guess, try ideas out. No structure required — just think out loud.');

  return sections.join('\n');
}

interface ExtractedFragment {
  claims: Omit<Claim, 'id'>[];
  assumptions: Omit<Assumption, 'id'>[];
  evidence: Omit<Evidence, 'id'>[];
  openQuestions: string[];
}

export function extractStateFragment(text: string, iteration: number): ExtractedFragment {
  const fragment: ExtractedFragment = { claims: [], assumptions: [], evidence: [], openQuestions: [] };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    // CLAIM: or - CLAIM: or **CLAIM**:
    const claimMatch = trimmed.match(/^[-*]?\s*\*?CLAIM\*?\s*[:：]\s*(.+)/i);
    if (claimMatch) { fragment.claims.push({ content: claimMatch[1].trim(), confidence: 0.5, source: 'planner', evidence: [], iteration }); continue; }

    // ASSUMPTION: or - ASSUMPTION: or **ASSUMPTION**:
    const assumptionMatch = trimmed.match(/^[-*]?\s*\*?ASSUMPTION\*?\s*[:：]\s*(.+)/i);
    if (assumptionMatch) { fragment.assumptions.push({ content: assumptionMatch[1].trim(), status: 'unverified', challengedBy: [], iteration }); continue; }

    // EVIDENCE: or - EVIDENCE: or **EVIDENCE**:
    const evidenceMatch = trimmed.match(/^[-*]?\s*\*?EVIDENCE\*?\s*[:：]\s*(.+)/i);
    if (evidenceMatch) { fragment.evidence.push({ content: evidenceMatch[1].trim(), type: 'logical', source: 'planner', reliable: true, iteration }); continue; }

    // QUESTION: or - QUESTION: or **QUESTION**:
    const questionMatch = trimmed.match(/^[-*]?\s*\*?QUESTION\*?\s*[:：]\s*(.+)/i);
    if (questionMatch) { fragment.openQuestions.push(questionMatch[1].trim()); continue; }
  }

  // Fallback: if no structured data was extracted, treat key sentences as claims
  if (fragment.claims.length === 0 && fragment.assumptions.length === 0 && fragment.openQuestions.length === 0) {
    const sentences = text.split(/[。\n]/).map(s => s.trim()).filter(s => s.length > 10 && s.length < 200);
    for (const sentence of sentences.slice(0, 5)) {
      fragment.claims.push({ content: sentence, confidence: 0.3, source: 'planner', evidence: [], iteration });
    }
  }

  return fragment;
}
