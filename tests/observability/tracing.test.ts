import { describe, it, expect } from 'vitest';
import { setupTracing, createSpan } from '../../src/observability/tracing.js';

describe('tracing', () => {
  it('should setup tracing without error when disabled', () => {
    expect(() => setupTracing({ enabled: false })).not.toThrow();
  });

  it('should return result from createSpan when disabled', () => {
    setupTracing({ enabled: false });
    const result = createSpan('test-operation', () => 'hello');
    expect(result).toBe('hello');
  });
});
