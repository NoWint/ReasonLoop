import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/index.js';

describe('loadConfig', () => {
  afterEach(() => {
    delete process.env.REASONLOOP_PORT;
    delete process.env.REASONLOOP_API_KEY;
    delete process.env.REASONLOOP_MODEL;
  });

  it('should return defaults when no config provided', () => {
    const config = loadConfig();
    expect(config.server.port).toBe(8080);
    expect(config.auth.enabled).toBe(false);
  });

  it('should override defaults with explicit values', () => {
    const config = loadConfig({ server: { port: 9090 } });
    expect(config.server.port).toBe(9090);
  });

  it('should load from environment variables', () => {
    process.env.REASONLOOP_PORT = '7070';
    process.env.REASONLOOP_API_KEY = 'test-key';
    const config = loadConfig();
    expect(config.server.port).toBe(7070);
    expect(config.auth.apiKeys).toContain('test-key');
  });

  it('should validate and throw on invalid config', () => {
    expect(() => loadConfig({ server: { port: -1 } })).toThrow();
  });
});
