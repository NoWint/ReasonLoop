import type { FastifyInstance } from 'fastify';
import type { GatewayContext } from '../types.js';
import type { ProxyRequest } from '../../core/types.js';
import { analyzeComplexity } from '../../core/complexity.js';
import { runLoop } from '../../engine/loop.js';
import { compileFinalResponse } from '../../core/compiler.js';
import { createAdapter } from '../../engine/adapter.js';

export async function registerAnthropicRoutes(app: FastifyInstance, ctx: GatewayContext) {
  app.post('/v1/messages', async (request, reply) => {
    const body = request.body as any;
    const req: ProxyRequest = {
      model: body.model,
      messages: body.messages ?? [],
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    };
    const adapter = createAdapter(ctx.config.provider, { apiKey: ctx.config.apiKey, baseUrl: ctx.config.baseUrl });

    const analysis = analyzeComplexity(req, ctx.config.complexityThreshold);

    if (!analysis.shouldLoop) {
      const response = await adapter.forward(req, 'anthropic');
      return reply.send(response);
    }

    const goal = req.messages[req.messages.length - 1]?.content ?? '';
    const sessionId = `session-${Date.now()}`;
    const result = await runLoop(goal, sessionId, ctx.config, adapter);
    ctx.sessions.set(sessionId, result.finalState);

    const compiled = compileFinalResponse(result.finalState, req.messages);

    return reply.send({
      id: sessionId,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: compiled }],
      model: body.model,
      stop_reason: 'end_turn',
      usage: { input_tokens: result.finalState.metadata.totalTokensUsed, output_tokens: 0 },
    });
  });
}
