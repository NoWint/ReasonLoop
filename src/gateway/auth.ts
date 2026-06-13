import type { FastifyRequest } from 'fastify';

interface AuthConfig {
  enabled: boolean;
  apiKeys: string[];
}

export function createAuthHook(config: AuthConfig) {
  return async (request: FastifyRequest) => {
    if (!config.enabled || config.apiKeys.length === 0) return;

    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

    let providedKey = '';
    if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7);
    } else if (apiKeyHeader) {
      providedKey = apiKeyHeader;
    }

    if (!providedKey || !config.apiKeys.includes(providedKey)) {
      const err = new Error('Unauthorized: Invalid or missing API key') as any;
      err.statusCode = 401;
      throw err;
    }
  };
}
