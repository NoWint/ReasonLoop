import type { FastifyInstance } from 'fastify';
import type { GatewayContext } from '../types.js';
import type { ProxyRequest } from '../../core/types.js';
import { analyzeComplexity } from '../../core/complexity.js';
import { runLoop } from '../../engine/loop.js';
import { compileFinalResponse } from '../../core/compiler.js';
import { createAdapter } from '../../engine/adapter.js';
import { emitAsSSE } from '../stream.js';

export async function registerAnthropicRoutes(app: FastifyInstance, ctx: GatewayContext) {
  app.post('/v1/messages', async (request, reply) => {
    const body = request.body as any;
    const req: ProxyRequest = {
      model: body.model,
      messages: body.messages ?? [],
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      stream: body.stream,
    };
    const adapter = createAdapter(ctx.config.provider, { apiKey: ctx.config.apiKey, baseUrl: ctx.config.baseUrl });

    const analysis = analyzeComplexity(req, ctx.config.complexityThreshold);

    // Streaming + low complexity: pipe upstream SSE with Anthropic format
    if (req.stream && !analysis.shouldLoop) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const response = await adapter.forward(req, 'anthropic') as any;
      const content = response.content?.[0]?.text ?? '';
      const messageId = response.id ?? `msg-${Date.now()}`;
      const chunks = emitAsSSE(content, 'anthropic', messageId, req.model);
      for (const chunk of chunks) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
      return reply;
    }

    // Streaming + high complexity: run loop, emit result as SSE with Anthropic format
    if (req.stream && analysis.shouldLoop) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const goal = req.messages[req.messages.length - 1]?.content ?? '';
      const sessionId = `session-${Date.now()}`;
      const result = await runLoop(goal, sessionId, ctx.config, adapter, { multiView: ctx.config.multiView });
      ctx.sessions.set(sessionId, result.finalState);

      const compiled = compileFinalResponse(result.finalState, req.messages);
      const chunks = emitAsSSE(compiled, 'anthropic', sessionId, req.model);
      for (const chunk of chunks) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
      return reply;
    }

    // Non-streaming: existing behavior
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
