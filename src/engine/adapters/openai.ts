import OpenAI from 'openai';
import type { ModelAdapter, AdapterConfig, AdapterOptions, AdapterResponse } from '../adapter.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';

export class OpenAIAdapter implements ModelAdapter {
  name = 'openai';
  private client: OpenAI;

  constructor(config: AdapterConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    });
    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  async forward(request: unknown, _protocol: 'openai' | 'anthropic'): Promise<unknown> {
    const req = request as ProxyRequest;
    const response = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages as any,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
    });
    const result: ProxyResponse = {
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map(c => ({
        index: c.index,
        message: { role: c.message?.role ?? 'assistant', content: c.message?.content ?? '' },
        finish_reason: c.finish_reason ?? 'stop',
      })),
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    };
    return result;
  }
}
