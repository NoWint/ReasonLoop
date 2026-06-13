import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../../src/core/complexity.js';
import type { ProxyRequest } from '../../src/core/types.js';

describe('Gateway Integration', () => {
  it('should correctly classify request complexity for routing', () => {
    const simple: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'What is TCP?' }] };
    const complex: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'Design a Minecraft launcher architecture' }] };

    expect(analyzeComplexity(simple).shouldLoop).toBe(false);
    expect(analyzeComplexity(complex).shouldLoop).toBe(true);
  });
});
