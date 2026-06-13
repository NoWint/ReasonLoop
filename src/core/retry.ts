export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
}

function isRetriable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return true;
  if (typeof err.status === 'number') {
    if (err.status >= 500 && err.status < 600) return true;
    if (err.status === 429) return true;
  }
  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxRetries || !isRetriable(error)) {
        throw error;
      }
      const delay = options.baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
