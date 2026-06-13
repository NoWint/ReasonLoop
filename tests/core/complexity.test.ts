import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../../src/core/complexity.js';
import type { ProxyRequest } from '../../src/core/types.js';

describe('Complexity Analyzer', () => {
  it('should identify simple factual questions as low complexity', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'What is TCP?' }] };
    const analysis = analyzeComplexity(req);
    expect(analysis.score).toBeLessThan(0.5);
    expect(analysis.shouldLoop).toBe(false);
  });

  it('should identify design tasks as high complexity', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'Design a Minecraft launcher architecture' }] };
    const analysis = analyzeComplexity(req);
    expect(analysis.score).toBeGreaterThanOrEqual(0.5);
    expect(analysis.shouldLoop).toBe(true);
  });

  it('should identify analysis tasks as high complexity', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze the trade-offs between microservices and monolith' }] };
    const analysis = analyzeComplexity(req);
    expect(analysis.shouldLoop).toBe(true);
  });

  it('should respect custom threshold', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'How does DNS work?' }] };
    const lowThreshold = analyzeComplexity(req, 0.1);
    const highThreshold = analyzeComplexity(req, 0.9);
    expect(lowThreshold.shouldLoop || !highThreshold.shouldLoop).toBe(true);
  });
});
