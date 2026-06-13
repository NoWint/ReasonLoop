import type { ReasoningState } from '../core/types.js';
import type { KnowledgeNode, KnowledgeEdge } from './types.js';

export interface ExtractionResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function extractKnowledge(state: ReasoningState): ExtractionResult {
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const nodeIds: string[] = [];

  // Extract entity from goal
  const goalEntity = extractMainConcept(state.goal);
  const goalNodeId = generateId('node');
  nodes.push({
    id: goalNodeId,
    type: 'entity',
    label: goalEntity,
    properties: { source: 'goal', goal: state.goal },
  });
  nodeIds.push(goalNodeId);

  // Extract concepts from claims
  for (const claim of state.claims) {
    const concept = extractMainConcept(claim.content);
    const claimNodeId = generateId('node');
    nodes.push({
      id: claimNodeId,
      type: 'concept',
      label: concept,
      properties: {
        source: 'claim',
        claimId: claim.id,
        confidence: claim.confidence,
      },
    });
    nodeIds.push(claimNodeId);

    // Create related-to edge from goal entity to each claim concept
    edges.push({
      id: generateId('edge'),
      source: goalNodeId,
      target: claimNodeId,
      type: 'related-to',
      weight: claim.confidence,
      evidence: [claim.id],
    });
  }

  // Create related-to edges between consecutive claim concepts
  const claimNodeIds = nodes.filter(n => n.type === 'concept').map(n => n.id);
  for (let i = 1; i < claimNodeIds.length; i++) {
    edges.push({
      id: generateId('edge'),
      source: claimNodeIds[i - 1],
      target: claimNodeIds[i],
      type: 'related-to',
      weight: 0.5,
      evidence: [],
    });
  }

  return { nodes, edges };
}

export function extractMainConcept(text: string): string {
  // Take the first meaningful phrase (up to first comma, semicolon, or period)
  const cleaned = text.trim();
  const stopChars = [',', ';', '.', '，', '；', '。'];
  let end = cleaned.length;
  for (const ch of stopChars) {
    const idx = cleaned.indexOf(ch);
    if (idx > 0 && idx < end) end = idx;
  }
  const phrase = cleaned.slice(0, end).trim();
  // Truncate to a reasonable label length
  if (phrase.length <= 60) return phrase;
  return phrase.slice(0, 57) + '...';
}
