import { describe, it, expect } from 'vitest';
import { ReasonLoopConfigSchema } from '../../src/config/schema.js';

describe('ReasonLoopConfigSchema', () => {
  it('should accept valid minimal config', () => {
    const result = ReasonLoopConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should fill defaults for missing fields', () => {
    const result = ReasonLoopConfigSchema.parse({});
    expect(result.server.port).toBe(8080);
    expect(result.server.host).toBe('0.0.0.0');
    expect(result.auth.enabled).toBe(false);
    expect(result.auth.apiKeys).toEqual([]);
    expect(result.rateLimit.maxRequests).toBe(100);
    expect(result.rateLimit.windowMs).toBe(60000);
    expect(result.complexity.threshold).toBe(0.5);
    expect(result.models.default).toBe('gpt-4');
    expect(result.models.timeout).toBe(60000);
    expect(result.observability.logLevel).toBe('info');
    expect(result.observability.metrics).toBe(true);
    expect(result.observability.tracing.enabled).toBe(false);
    expect(result.storage.type).toBe('sqlite');
    expect(result.storage.path).toBe('./data/reasonloop');
    expect(result.multiView.enabled).toBe(false);
    expect(result.memory.enabled).toBe(false);
    expect(result.memory.topK).toBe(5);
    expect(result.loop.timeout).toBe(300000);
    expect(result.loop.maxRetries).toBe(3);
    expect(result.loop.retryBaseDelay).toBe(1000);
  });

  it('should reject invalid port', () => {
    const result = ReasonLoopConfigSchema.safeParse({ server: { port: -1 } });
    expect(result.success).toBe(false);
  });

  it('should reject invalid complexity threshold', () => {
    const result = ReasonLoopConfigSchema.safeParse({ complexity: { threshold: 1.5 } });
    expect(result.success).toBe(false);
  });

  it('should auto-detect auth.enabled from apiKeys', () => {
    const result = ReasonLoopConfigSchema.parse({ auth: { apiKeys: ['key1', 'key2'] } });
    expect(result.auth.enabled).toBe(true);
  });
});
