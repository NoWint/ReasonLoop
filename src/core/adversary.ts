import type { ReasoningState, CriticOutput } from './types.js';

export function buildAdversaryPrompt(state: ReasoningState): string {
  const sections: string[] = [];
  sections.push('## Adversary Attack\n');
  sections.push('Your role is to actively attack and undermine the reasoning. Construct counter-examples, break assumptions, find edge cases.\n');

  if (state.claims.length > 0) {
    sections.push('### Claims to Attack');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }
  if (state.assumptions.length > 0) {
    sections.push('### Assumptions to Break');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
    sections.push('');
  }

  sections.push('### Attack Strategies');
  sections.push('- Construct counter-examples');
  sections.push('- Identify edge cases and extreme scenarios');
  sections.push('- Challenge assumptions with contradictory evidence');
  sections.push('');
  sections.push('### Output Format');
  sections.push('- ISSUE: <counter-example or attack>');
  sections.push('- RISK: <scenario where reasoning fails>');
  sections.push('- CONTRADICTION: <direct conflict>');
  sections.push('- SUGGESTION: <how to make the claim more robust>');

  return sections.join('\n');
}

export function parseAdversaryOutput(response: string): CriticOutput {
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
