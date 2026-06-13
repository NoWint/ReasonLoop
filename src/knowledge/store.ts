import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { KnowledgeNode, KnowledgeEdge, KnowledgeNodeType, KnowledgeEdgeType } from './types.js';

export class KnowledgeStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        evidence TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (source) REFERENCES nodes(id),
        FOREIGN KEY (target) REFERENCES nodes(id)
      );
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
    `);
  }

  addNode(node: KnowledgeNode): void {
    this.db.prepare(`
      INSERT INTO nodes (id, type, label, properties)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type, label = excluded.label, properties = excluded.properties
    `).run(node.id, node.type, node.label, JSON.stringify(node.properties));
  }

  addEdge(edge: KnowledgeEdge): void {
    this.db.prepare(`
      INSERT INTO edges (id, source, target, type, weight, evidence)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source, target = excluded.target,
        type = excluded.type, weight = excluded.weight, evidence = excluded.evidence
    `).run(edge.id, edge.source, edge.target, edge.type, edge.weight, JSON.stringify(edge.evidence));
  }

  getNode(id: string): KnowledgeNode | null {
    const row = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      type: row.type as KnowledgeNodeType,
      label: row.label,
      properties: JSON.parse(row.properties),
    };
  }

  getNeighbors(nodeId: string): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    const edgeRows = this.db.prepare(
      'SELECT * FROM edges WHERE source = ? OR target = ?'
    ).all(nodeId, nodeId) as any[];

    const edges: KnowledgeEdge[] = edgeRows.map(r => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type as KnowledgeEdgeType,
      weight: r.weight,
      evidence: JSON.parse(r.evidence),
    }));

    const neighborIds = new Set<string>();
    for (const e of edges) {
      if (e.source !== nodeId) neighborIds.add(e.source);
      if (e.target !== nodeId) neighborIds.add(e.target);
    }

    const nodes: KnowledgeNode[] = [];
    const getNodeStmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    for (const nid of neighborIds) {
      const row = getNodeStmt.get(nid) as any;
      if (row) {
        nodes.push({
          id: row.id,
          type: row.type as KnowledgeNodeType,
          label: row.label,
          properties: JSON.parse(row.properties),
        });
      }
    }

    return { nodes, edges };
  }

  close(): void {
    this.db.close();
  }
}
