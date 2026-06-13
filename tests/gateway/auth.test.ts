import { describe, it, expect } from 'vitest';
import { createAuthHook } from '../../src/gateway/auth.js';

describe('createAuthHook', () => {
  it('should skip validation when no apiKeys configured', async () => {
    const hook = createAuthHook({ enabled: false, apiKeys: [] });
    const mockRequest = { headers: {} } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeUndefined();
  });

  it('should accept valid API key in Authorization header', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: { authorization: 'Bearer valid-key' } } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeUndefined();
  });

  it('should accept valid API key in x-api-key header', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: { 'x-api-key': 'valid-key' } } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeUndefined();
  });

  it('should reject invalid API key', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: { authorization: 'Bearer wrong-key' } } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
  });

  it('should reject missing API key when auth is enabled', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: {} } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
  });
});
