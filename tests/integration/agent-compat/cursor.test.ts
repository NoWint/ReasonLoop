import { describe, it, expect } from 'vitest';
import { formatOpenAIStreamChunk } from '../../../src/gateway/stream.js';

describe('Cursor – OpenAI chat completion format compatibility', () => {
  it('should produce a chunk with object=chat.completion.chunk', () => {
    const chunk = formatOpenAIStreamChunk('chatcmpl-xyz', 'Hello');
    const parsed = JSON.parse(chunk.replace('data: ', '').trim());

    expect(parsed.object).toBe('chat.completion.chunk');
    expect(parsed.id).toBe('chatcmpl-xyz');
  });

  it('should include choices array with delta content', () => {
    const chunk = formatOpenAIStreamChunk('chatcmpl-xyz', 'Hello');
    const parsed = JSON.parse(chunk.replace('data: ', '').trim());

    expect(Array.isArray(parsed.choices)).toBe(true);
    expect(parsed.choices.length).toBe(1);
    expect(parsed.choices[0].index).toBe(0);
    expect(parsed.choices[0].delta.content).toBe('Hello');
  });

  it('should set finish_reason=null for content chunks', () => {
    const chunk = formatOpenAIStreamChunk('chatcmpl-xyz', 'Hello');
    const parsed = JSON.parse(chunk.replace('data: ', '').trim());

    expect(parsed.choices[0].finish_reason).toBeNull();
  });

  it('should emit [DONE] signal when content is null', () => {
    const done = formatOpenAIStreamChunk('chatcmpl-xyz', null);

    expect(done).toContain('[DONE]');
    expect(done).toMatch(/^data: \[DONE\]\n\n$/);
  });

  it('should include a valid created timestamp', () => {
    const chunk = formatOpenAIStreamChunk('chatcmpl-xyz', 'Hello');
    const parsed = JSON.parse(chunk.replace('data: ', '').trim());

    expect(typeof parsed.created).toBe('number');
    expect(parsed.created).toBeGreaterThan(0);
    // Should be a Unix timestamp in seconds (reasonable range)
    expect(parsed.created).toBeLessThan(2_000_000_000);
  });

  it('should produce SSE-formatted output with data: prefix and double newline', () => {
    const chunk = formatOpenAIStreamChunk('chatcmpl-xyz', 'Hello');

    expect(chunk).toMatch(/^data: /);
    expect(chunk).toMatch(/\n\n$/);
  });
});
