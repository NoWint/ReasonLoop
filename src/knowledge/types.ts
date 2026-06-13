export type KnowledgeNodeType = 'concept' | 'entity' | 'pattern' | 'anti-pattern';

export type KnowledgeEdgeType = 'depends-on' | 'contradicts' | 'supports' | 'related-to' | 'is-a';

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: KnowledgeEdgeType;
  weight: number;
  evidence: string[];
}

export interface KnowledgeSubgraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}
