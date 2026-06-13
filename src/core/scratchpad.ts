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

  sections.push('## Instructions');
  sections.push('Think freely. Use these prefixes:');
  sections.push('- CLAIM: <factual assertion>');
  sections.push('- ASSUMPTION: <unstated premise>');
  sections.push('- EVIDENCE: <supporting data>');
  sections.push('- QUESTION: <open question>');

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
    const claimMatch = trimmed.match(/^CLAIM:\s*(.+)/i);
    if (claimMatch) { fragment.claims.push({ content: claimMatch[1].trim(), confidence: 0.5, source: 'planner', evidence: [], iteration }); continue; }
    const assumptionMatch = trimmed.match(/^ASSUMPTION:\s*(.+)/i);
    if (assumptionMatch) { fragment.assumptions.push({ content: assumptionMatch[1].trim(), status: 'unverified', challengedBy: [], iteration }); continue; }
    const evidenceMatch = trimmed.match(/^EVIDENCE:\s*(.+)/i);
    if (evidenceMatch) { fragment.evidence.push({ content: evidenceMatch[1].trim(), type: 'logical', source: 'planner', reliable: true, iteration }); continue; }
    const questionMatch = trimmed.match(/^QUESTION:\s*(.+)/i);
    if (questionMatch) { fragment.openQuestions.push(questionMatch[1].trim()); continue; }
  }

  return fragment;
}
