import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { ServerConfig } from '../core/types.js';
import type { GatewayContext } from './types.js';
import { requestIdMiddleware, errorHandler } from './middleware.js';
import { createAuthHook } from './auth.js';
import { registerOpenAIRoutes } from './routes/openai.js';
import { registerAnthropicRoutes } from './routes/anthropic.js';

export async function startServer(config: ServerConfig): Promise<void> {
  const app = Fastify({ logger: true });
  const ctx: GatewayContext = { config, sessions: new Map() };

  await app.register(cors, { origin: true });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Register auth hook when apiKeys are configured
  const apiKeys = (config as any).apiKeys as string[] | undefined;
  if (apiKeys && apiKeys.length > 0) {
    app.addHook('preHandler', createAuthHook({ enabled: true, apiKeys }));
  }

  app.addHook('onRequest', requestIdMiddleware);
  app.setErrorHandler(errorHandler);

  await registerOpenAIRoutes(app, ctx);
  await registerAnthropicRoutes(app, ctx);

  app.get('/v1/models', async () => ({
    object: 'list',
    data: [{ id: config.model, object: 'model', owned_by: 'reasonloop' }],
  }));

  app.get('/v1/sessions', async () => ({
    sessions: [...ctx.sessions.entries()].map(([id, state]) => ({
      id,
      goal: state.goal,
      iteration: state.iteration,
      stability: state.metadata.stability,
      claims: state.claims.length,
    })),
  }));

  app.get('/metrics', async (_request, reply) => {
    reply.type('text/plain');
    return '# ReasonLoop Metrics\n# TODO: integrate prom-client registry\n';
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`ReasonLoop Gateway running on port ${config.port}`);
}
