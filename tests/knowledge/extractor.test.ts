import { describe, it, expect } from 'vitest';
import { extractKnowledge, extractMainConcept } from '../../src/knowledge/extractor.js';
import type { ReasoningState } from '../../src/core/types.js';

describe('KnowledgeExtractor', () => {
  describe('extractMainConcept', () => {
    it('should return the full text if short enough', () => {
      expect(extractMainConcept('Minecraft launcher')).toBe('Minecraft launcher');
    });

    it('should truncate at first comma', () => {
      expect(extractMainConcept('Minecraft launcher, with mod support')).toBe('Minecraft launcher');
    });

    it('should truncate at first period', () => {
      expect(extractMainConcept('Design a system. It should scale.')).toBe('Design a system');
    });

    it('should truncate at first semicolon', () => {
      expect(extractMainConcept('Authentication module; authorization follows')).toBe('Authentication module');
    });

    it('should truncate long text with ellipsis', () => {
      const longText = 'A'.repeat(100);
      const result = extractMainConcept(longText);
      expect(result.length).toBeLessThanOrEqual(60);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('extractKnowledge', () => {
    it('should extract an entity node from the goal', () => {
      const state: ReasoningState = {
        id: 's1',
        goal: 'Design a Minecraft launcher',
        iteration: 1,
        claims: [],
        assumptions: [],
        evidence: [],
        openQuestions: [],
        controversies: [],
        metadata: {
          stability: 0,
          complexity: 0.5,
          lastAction: 'init',
          budgetRemaining: 100000,
          totalTokensUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const result = extractKnowledge(state);
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      const entityNode = result.nodes.find(n => n.type === 'entity');
      expect(entityNode).toBeDefined();
      expect(entityNode!.label).toBe('Design a Minecraft launcher');
      expect(entityNode!.properties.source).toBe('goal');
    });

    it('should extract concept nodes from claims', () => {
      const state: ReasoningState = {
        id: 's1',
        goal: 'Design a Minecraft launcher',
        iteration: 1,
        claims: [
          { id: 'c1', content: 'Need authentication system', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 },
          { id: 'c2', content: 'Mod loading is essential', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 },
        ],
        assumptions: [],
        evidence: [],
        openQuestions: [],
        controversies: [],
        metadata: {
          stability: 0,
          complexity: 0.5,
          lastAction: 'init',
          budgetRemaining: 100000,
          totalTokensUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const result = extractKnowledge(state);
      const conceptNodes = result.nodes.filter(n => n.type === 'concept');
      expect(conceptNodes).toHaveLength(2);
      expect(conceptNodes[0].label).toBe('Need authentication system');
      expect(conceptNodes[1].label).toBe('Mod loading is essential');
    });

    it('should create related-to edges from goal entity to claim concepts', () => {
      const state: ReasoningState = {
        id: 's1',
        goal: 'Design a Minecraft launcher',
        iteration: 1,
        claims: [
          { id: 'c1', content: 'Need auth', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 },
        ],
        assumptions: [],
        evidence: [],
        openQuestions: [],
        controversies: [],
        metadata: {
          stability: 0,
          complexity: 0.5,
          lastAction: 'init',
          budgetRemaining: 100000,
          totalTokensUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const result = extractKnowledge(state);
      const entityNode = result.nodes.find(n => n.type === 'entity');
      const conceptNode = result.nodes.find(n => n.type === 'concept');

      const goalEdge = result.edges.find(e => e.source === entityNode!.id && e.target === conceptNode!.id);
      expect(goalEdge).toBeDefined();
      expect(goalEdge!.type).toBe('related-to');
      expect(goalEdge!.weight).toBe(0.8);
      expect(goalEdge!.evidence).toEqual(['c1']);
    });

    it('should create related-to edges between consecutive claim concepts', () => {
      const state: ReasoningState = {
        id: 's1',
        goal: 'Design a Minecraft launcher',
        iteration: 1,
        claims: [
          { id: 'c1', content: 'Need auth', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 },
          { id: 'c2', content: 'Need mods', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 },
        ],
        assumptions: [],
        evidence: [],
        openQuestions: [],
        controversies: [],
        metadata: {
          stability: 0,
          complexity: 0.5,
          lastAction: 'init',
          budgetRemaining: 100000,
          totalTokensUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const result = extractKnowledge(state);
      const conceptNodes = result.nodes.filter(n => n.type === 'concept');
      // Should have: 2 goal-to-concept edges + 1 concept-to-concept edge = 3 edges
      const conceptEdge = result.edges.find(
        e => e.source === conceptNodes[0].id && e.target === conceptNodes[1].id
      );
      expect(conceptEdge).toBeDefined();
      expect(conceptEdge!.type).toBe('related-to');
      expect(conceptEdge!.weight).toBe(0.5);
    });

    it('should handle state with no claims', () => {
      const state: ReasoningState = {
        id: 's1',
        goal: 'Design a Minecraft launcher',
        iteration: 0,
        claims: [],
        assumptions: [],
        evidence: [],
        openQuestions: [],
        controversies: [],
        metadata: {
          stability: 0,
          complexity: 0.5,
          lastAction: 'init',
          budgetRemaining: 100000,
          totalTokensUsed: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const result = extractKnowledge(state);
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);
    });
  });
});
