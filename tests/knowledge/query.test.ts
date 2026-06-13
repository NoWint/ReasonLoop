import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeStore } from '../../src/knowledge/store.js';
import { KnowledgeQuery } from '../../src/knowledge/query.js';
import type { KnowledgeNode, KnowledgeEdge } from '../../src/knowledge/types.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('KnowledgeQuery', () => {
  let store: KnowledgeStore;
  let query: KnowledgeQuery;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-knowledge-test-'));
    const dbPath = path.join(tmpDir, 'test.db');
    store = new KnowledgeStore(dbPath);
    query = new KnowledgeQuery(store);
  });

  afterEach(async () => {
    store.close();
    try { await fs.rm(tmpDir, { recursive: true }); } catch { /* ignore */ }
  });

  describe('getSubgraph', () => {
    it('should return a single node with depth 0', () => {
      const node: KnowledgeNode = { id: 'n1', type: 'entity', label: 'Minecraft', properties: {} };
      store.addNode(node);

      const subgraph = query.getSubgraph(['n1'], 0);
      expect(subgraph.nodes).toHaveLength(1);
      expect(subgraph.nodes[0].id).toBe('n1');
      expect(subgraph.edges).toHaveLength(0);
    });

    it('should traverse one hop with depth 1', () => {
      const n1: KnowledgeNode = { id: 'n1', type: 'entity', label: 'Minecraft', properties: {} };
      const n2: KnowledgeNode = { id: 'n2', type: 'concept', label: 'Auth', properties: {} };
      const e1: KnowledgeEdge = { id: 'e1', source: 'n1', target: 'n2', type: 'related-to', weight: 0.8, evidence: [] };

      store.addNode(n1);
      store.addNode(n2);
      store.addEdge(e1);

      const subgraph = query.getSubgraph(['n1'], 1);
      expect(subgraph.nodes).toHaveLength(2);
      expect(subgraph.edges).toHaveLength(1);
    });

    it('should traverse two hops with depth 2', () => {
      const n1: KnowledgeNode = { id: 'n1', type: 'entity', label: 'Minecraft', properties: {} };
      const n2: KnowledgeNode = { id: 'n2', type: 'concept', label: 'Auth', properties: {} };
      const n3: KnowledgeNode = { id: 'n3', type: 'concept', label: 'OAuth', properties: {} };
      const e1: KnowledgeEdge = { id: 'e1', source: 'n1', target: 'n2', type: 'related-to', weight: 0.8, evidence: [] };
      const e2: KnowledgeEdge = { id: 'e2', source: 'n2', target: 'n3', type: 'depends-on', weight: 1.0, evidence: [] };

      store.addNode(n1);
      store.addNode(n2);
      store.addNode(n3);
      store.addEdge(e1);
      store.addEdge(e2);

      const subgraph = query.getSubgraph(['n1'], 2);
      expect(subgraph.nodes).toHaveLength(3);
      expect(subgraph.edges).toHaveLength(2);
    });

    it('should not revisit already visited nodes', () => {
      const n1: KnowledgeNode = { id: 'n1', type: 'entity', label: 'A', properties: {} };
      const n2: KnowledgeNode = { id: 'n2', type: 'concept', label: 'B', properties: {} };
      const e1: KnowledgeEdge = { id: 'e1', source: 'n1', target: 'n2', type: 'related-to', weight: 1.0, evidence: [] };
      const e2: KnowledgeEdge = { id: 'e2', source: 'n2', target: 'n1', type: 'related-to', weight: 1.0, evidence: [] };

      store.addNode(n1);
      store.addNode(n2);
      store.addEdge(e1);
      store.addEdge(e2);

      const subgraph = query.getSubgraph(['n1'], 5);
      expect(subgraph.nodes).toHaveLength(2);
    });

    it('should return empty subgraph for non-existent node', () => {
      const subgraph = query.getSubgraph(['nonexistent'], 1);
      expect(subgraph.nodes).toHaveLength(0);
      expect(subgraph.edges).toHaveLength(0);
    });

    it('should support multiple starting nodes', () => {
      const n1: KnowledgeNode = { id: 'n1', type: 'entity', label: 'A', properties: {} };
      const n2: KnowledgeNode = { id: 'n2', type: 'entity', label: 'B', properties: {} };
      const n3: KnowledgeNode = { id: 'n3', type: 'concept', label: 'C', properties: {} };
      const e1: KnowledgeEdge = { id: 'e1', source: 'n1', target: 'n3', type: 'related-to', weight: 0.5, evidence: [] };
      const e2: KnowledgeEdge = { id: 'e2', source: 'n2', target: 'n3', type: 'supports', weight: 0.7, evidence: [] };

      store.addNode(n1);
      store.addNode(n2);
      store.addNode(n3);
      store.addEdge(e1);
      store.addEdge(e2);

      const subgraph = query.getSubgraph(['n1', 'n2'], 1);
      expect(subgraph.nodes).toHaveLength(3);
      expect(subgraph.edges).toHaveLength(2);
    });
  });

  describe('formatAsContext', () => {
    it('should return empty string for empty subgraph', () => {
      expect(query.formatAsContext({ nodes: [], edges: [] })).toBe('');
    });

    it('should format nodes with type and label', () => {
      const subgraph = {
        nodes: [
          { id: 'n1', type: 'entity' as const, label: 'Minecraft', properties: {} },
        ],
        edges: [],
      };
      const result = query.formatAsContext(subgraph);
      expect(result).toContain('[Knowledge Graph Context]');
      expect(result).toContain('[entity] Minecraft (n1)');
    });

    it('should format edges with type and weight', () => {
      const subgraph = {
        nodes: [
          { id: 'n1', type: 'entity' as const, label: 'A', properties: {} },
          { id: 'n2', type: 'concept' as const, label: 'B', properties: {} },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', type: 'related-to' as const, weight: 0.8, evidence: ['c1'] },
        ],
      };
      const result = query.formatAsContext(subgraph);
      expect(result).toContain('n1 --[related-to]--> n2');
      expect(result).toContain('weight: 0.80');
      expect(result).toContain('evidence: c1');
    });

    it('should omit evidence when empty', () => {
      const subgraph = {
        nodes: [
          { id: 'n1', type: 'entity' as const, label: 'A', properties: {} },
          { id: 'n2', type: 'concept' as const, label: 'B', properties: {} },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', type: 'is-a' as const, weight: 1.0, evidence: [] },
        ],
      };
      const result = query.formatAsContext(subgraph);
      expect(result).toContain('n1 --[is-a]--> n2');
      expect(result).not.toContain('evidence:');
    });
  });
});
