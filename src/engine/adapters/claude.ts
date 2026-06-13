import Anthropic from '@anthropic-ai/sdk';
import type { ModelAdapter, AdapterConfig, AdapterOptions, AdapterResponse } from '../adapter.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';

export class ClaudeAdapter implements ModelAdapter {
  name = 'claude';
  private client: Anthropic;

  constructor(config: AdapterConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse> {
    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 2000,
      system: options.systemPrompt ?? 'You are a reasoning assistant.',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
    });
    const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async forward(request: unknown, _protocol: 'openai' | 'anthropic'): Promise<unknown> {
    const req = request as ProxyRequest;
    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.max_tokens ?? 2000,
      system: 'You are a helpful assistant.',
      messages: req.messages as any,
      temperature: req.temperature,
    });
    const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const result: ProxyResponse = {
      id: response.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
    return result;
  }
}
