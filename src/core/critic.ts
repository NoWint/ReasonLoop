import type { ReasoningState, CriticOutput } from './types.js';

export function buildCriticPrompt(state: ReasoningState): string {
  const sections: string[] = [];
  sections.push('## Critic Evaluation\n');
  sections.push('Evaluate the reasoning state for logical issues, risks, contradictions, and suggest improvements.\n');

  if (state.claims.length > 0) {
    sections.push('### Claims to Evaluate');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }
  if (state.assumptions.length > 0) {
    sections.push('### Assumptions to Challenge');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
    sections.push('');
  }

  sections.push('### Output Format');
  sections.push('- ISSUE: <logical problem or gap>');
  sections.push('- RISK: <potential negative outcome>');
  sections.push('- CONTRADICTION: <conflict between claims or evidence>');
  sections.push('- SUGGESTION: <recommended improvement>');

  return sections.join('\n');
}

export function parseCriticOutput(response: string): CriticOutput {
  const output: CriticOutput = { issues: [], risks: [], contradictions: [], suggestions: [] };
  for (const line of response.split('\n')) {
    const trimmed = line.trim();
    const issueMatch = trimmed.match(/^ISSUE:\s*(.+)/i);
    if (issueMatch) { output.issues.push(issueMatch[1].trim()); continue; }
    const riskMatch = trimmed.match(/^RISK:\s*(.+)/i);
    if (riskMatch) { output.risks.push(riskMatch[1].trim()); continue; }
    const contradictionMatch = trimmed.match(/^CONTRADICTION:\s*(.+)/i);
    if (contradictionMatch) { output.contradictions.push(contradictionMatch[1].trim()); continue; }
    const suggestionMatch = trimmed.match(/^SUGGESTION:\s*(.+)/i);
    if (suggestionMatch) { output.suggestions.push(suggestionMatch[1].trim()); continue; }
  }
  return output;
}
