export interface AdapterConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ModelAdapter {
  name: string;
  complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse>;
  forward(request: unknown, protocol: 'openai' | 'anthropic'): Promise<unknown>;
}

export interface AdapterOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AdapterResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

import { OpenAIAdapter } from './adapters/openai.js';
import { ClaudeAdapter } from './adapters/claude.js';

export function createAdapter(type: 'openai' | 'claude', config: AdapterConfig): ModelAdapter {
  switch (type) {
    case 'openai': return new OpenAIAdapter(config);
    case 'claude': return new ClaudeAdapter(config);
    default: throw new Error(`Unknown adapter type: ${type}`);
  }
}
