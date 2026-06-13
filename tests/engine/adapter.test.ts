import { describe, it, expect } from 'vitest';
import { createAdapter } from '../../src/engine/adapter.js';

describe('Model Adapter', () => {
  it('should create OpenAI adapter', () => {
    const adapter = createAdapter('openai', { apiKey: 'test-key' });
    expect(adapter.name).toBe('openai');
  });

  it('should create Claude adapter', () => {
    const adapter = createAdapter('claude', { apiKey: 'test-key' });
    expect(adapter.name).toBe('claude');
  });

  it('should throw for unknown adapter type', () => {
    expect(() => createAdapter('unknown' as any, { apiKey: 'test' })).toThrow();
  });
});
