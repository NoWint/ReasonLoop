import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../../src/core/retry.js';

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retriable error and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should exhaust retries and throw', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retriable errors', async () => {
    const err: any = new Error('bad request');
    err.status = 400;
    const fn = vi.fn().mockRejectedValue(err);
    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 status', async () => {
    const err: any = new Error('rate limited');
    err.status = 429;
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
