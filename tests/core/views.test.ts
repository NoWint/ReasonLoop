import { describe, it, expect } from 'vitest';
import { BUILT_IN_VIEWS, getViewById } from '../../src/core/views.js';

describe('Views', () => {
  describe('BUILT_IN_VIEWS', () => {
    it('should have 4 built-in views', () => {
      expect(BUILT_IN_VIEWS).toHaveLength(4);
    });

    it('should have correct structure for each view', () => {
      for (const view of BUILT_IN_VIEWS) {
        expect(view.id).toBeTruthy();
        expect(view.name).toBeTruthy();
        expect(view.systemPrompt).toBeTruthy();
        expect(Array.isArray(view.focusAreas)).toBe(true);
        expect(view.focusAreas.length).toBeGreaterThan(0);
        expect(view.weight).toBeGreaterThan(0);
        expect(view.weight).toBeLessThanOrEqual(1);
      }
    });

    it('should have unique IDs', () => {
      const ids = BUILT_IN_VIEWS.map(v => v.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should include architect view', () => {
      const architect = getViewById('architect');
      expect(architect).toBeDefined();
      expect(architect!.name).toBe('Architect');
    });

    it('should include security-engineer view', () => {
      const sec = getViewById('security-engineer');
      expect(sec).toBeDefined();
      expect(sec!.name).toBe('Security Engineer');
    });

    it('should include devops view', () => {
      const devops = getViewById('devops');
      expect(devops).toBeDefined();
      expect(devops!.name).toBe('DevOps');
    });

    it('should include pragmatist view', () => {
      const prag = getViewById('pragmatist');
      expect(prag).toBeDefined();
      expect(prag!.name).toBe('Pragmatist');
    });
  });

  describe('getViewById', () => {
    it('should return undefined for unknown id', () => {
      expect(getViewById('nonexistent')).toBeUndefined();
    });

    it('should return the correct view by id', () => {
      const view = getViewById('architect');
      expect(view).toBeDefined();
      expect(view!.id).toBe('architect');
    });
  });
});
