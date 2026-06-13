import { describe, it, expect } from 'vitest';
import { createSSEEncoder, emitAsSSE, formatOpenAIStreamChunk, formatAnthropicStreamEvents } from '../../src/gateway/stream.js';

describe('createSSEEncoder', () => {
  it('should encode JSON as SSE data line', () => {
    const encode = createSSEEncoder();
    const result = encode({ hello: 'world' });
    expect(result).toMatch(/^data: /);
    expect(result).toMatch(/\n\n$/);
  });
});

describe('formatOpenAIStreamChunk', () => {
  it('should format an OpenAI streaming chunk', () => {
    const chunk = formatOpenAIStreamChunk('chatcmpl-123', 'Hello');
    expect(chunk).toContain('data: ');
    const parsed = JSON.parse(chunk.replace('data: ', '').trim());
    expect(parsed.object).toBe('chat.completion.chunk');
    expect(parsed.choices[0].delta.content).toBe('Hello');
  });

  it('should format the [DONE] signal', () => {
    const done = formatOpenAIStreamChunk('chatcmpl-123', null);
    expect(done).toContain('[DONE]');
  });
});

describe('formatAnthropicStreamEvents', () => {
  it('should format Anthropic streaming events', () => {
    const events = formatAnthropicStreamEvents('msg-123', 'Hello world');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toContain('event: message_start');
    expect(events.some(e => e.includes('content_block_delta'))).toBe(true);
    expect(events[events.length - 1]).toContain('event: message_stop');
  });
});

describe('emitAsSSE', () => {
  it('should wrap a complete response as SSE chunks for OpenAI', () => {
    const chunks = emitAsSSE('Hello world', 'openai', 'chatcmpl-123', 'gpt-4');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[chunks.length - 1]).toContain('[DONE]');
  });

  it('should wrap a complete response as SSE events for Anthropic', () => {
    const events = emitAsSSE('Hello world', 'anthropic', 'msg-123', 'claude-3');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toContain('event: message_start');
  });
});
