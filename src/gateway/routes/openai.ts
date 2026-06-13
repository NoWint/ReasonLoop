import type { FastifyInstance } from 'fastify';
import type { GatewayContext } from '../types.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';
import { analyzeComplexity } from '../../core/complexity.js';
import { runLoop } from '../../engine/loop.js';
import { compileFinalResponse } from '../../core/compiler.js';
import { createAdapter } from '../../engine/adapter.js';
import { emitAsSSE } from '../stream.js';

export async function registerOpenAIRoutes(app: FastifyInstance, ctx: GatewayContext) {
  app.post('/v1/chat/completions', async (request, reply) => {
    const req = request.body as ProxyRequest;
    const adapter = createAdapter(ctx.config.provider, { apiKey: ctx.config.apiKey, baseUrl: ctx.config.baseUrl });

    const analysis = analyzeComplexity(req, ctx.config.complexityThreshold);

    // Streaming + low complexity: pipe upstream SSE
    if (req.stream && !analysis.shouldLoop) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const response = await adapter.forward(req, 'openai') as ProxyResponse;
      const content = response.choices[0]?.message?.content ?? '';
      const chunks = emitAsSSE(content, 'openai', response.id, req.model);
      for (const chunk of chunks) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
      return reply;
    }

    // Streaming + high complexity: run loop, emit result as SSE
    if (req.stream && analysis.shouldLoop) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const goal = req.messages[req.messages.length - 1]?.content ?? '';
      const sessionId = `session-${Date.now()}`;
      const result = await runLoop(goal, sessionId, ctx.config, adapter);
      ctx.sessions.set(sessionId, result.finalState);

      const compiled = compileFinalResponse(result.finalState, req.messages);
      const chunks = emitAsSSE(compiled, 'openai', sessionId, req.model);
      for (const chunk of chunks) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
      return reply;
    }

    // Non-streaming: existing behavior
    if (!analysis.shouldLoop) {
      const response = await adapter.forward(req, 'openai') as ProxyResponse;
      return reply.send(response);
    }

      const goal = req.messages[req.messages.length - 1]?.content ?? '';
      const sessionId = `session-${Date.now()}`;
      const result = await runLoop(goal, sessionId, ctx.config, adapter, { multiView: ctx.config.multiView });
      ctx.sessions.set(sessionId, result.finalState);

    const compiled = compileFinalResponse(result.finalState, req.messages);
    const response: ProxyResponse = {
      id: sessionId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: req.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: compiled },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: result.finalState.metadata.totalTokensUsed,
        completion_tokens: 0,
        total_tokens: result.finalState.metadata.totalTokensUsed,
      },
    };

    return reply.send(response);
  });
}
