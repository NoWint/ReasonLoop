import { describe, it, expect } from 'vitest';
import { createLogger } from '../../src/observability/logger.js';

describe('createLogger', () => {
  it('should create a logger with default level', () => {
    const logger = createLogger({ logLevel: 'info' });
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  it('should create a logger with debug level', () => {
    const logger = createLogger({ logLevel: 'debug' });
    expect(logger.level).toBe('debug');
  });

  it('should support child logger with context', () => {
    const logger = createLogger({ logLevel: 'info' });
    const child = logger.child({ requestId: 'req-123', sessionId: 'sess-456' });
    expect(child).toBeDefined();
  });
});
