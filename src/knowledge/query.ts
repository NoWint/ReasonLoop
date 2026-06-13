import type { KnowledgeStore } from './store.js';
import type { KnowledgeSubgraph, KnowledgeNode, KnowledgeEdge } from './types.js';

export class KnowledgeQuery {
  private store: KnowledgeStore;

  constructor(store: KnowledgeStore) {
    this.store = store;
  }

  getSubgraph(nodeIds: string[], depth: number): KnowledgeSubgraph {
    const visitedNodes = new Map<string, KnowledgeNode>();
    const visitedEdges = new Map<string, KnowledgeEdge>();

    let currentIds = new Set(nodeIds);

    for (let d = 0; d <= depth; d++) {
      const nextIds = new Set<string>();

      for (const nid of currentIds) {
        if (visitedNodes.has(nid)) continue;

        const node = this.store.getNode(nid);
        if (!node) continue;
        visitedNodes.set(nid, node);

        const { nodes: neighbors, edges } = this.store.getNeighbors(nid);
        for (const edge of edges) {
          if (!visitedEdges.has(edge.id)) {
            visitedEdges.set(edge.id, edge);
          }
        }
        for (const neighbor of neighbors) {
          if (!visitedNodes.has(neighbor.id)) {
            nextIds.add(neighbor.id);
          }
        }
      }

      currentIds = nextIds;
    }

    return {
      nodes: [...visitedNodes.values()],
      edges: [...visitedEdges.values()],
    };
  }

  formatAsContext(subgraph: KnowledgeSubgraph): string {
    if (subgraph.nodes.length === 0) return '';

    const lines: string[] = ['[Knowledge Graph Context]'];

    lines.push('Nodes:');
    for (const node of subgraph.nodes) {
      lines.push(`  - [${node.type}] ${node.label} (${node.id})`);
    }

    if (subgraph.edges.length > 0) {
      lines.push('Edges:');
      for (const edge of subgraph.edges) {
        const evidenceStr = edge.evidence.length > 0 ? ` evidence: ${edge.evidence.join(',')}` : '';
        lines.push(`  - ${edge.source} --[${edge.type}]--> ${edge.target} (weight: ${edge.weight.toFixed(2)}${evidenceStr})`);
      }
    }

    return lines.join('\n');
  }
}
