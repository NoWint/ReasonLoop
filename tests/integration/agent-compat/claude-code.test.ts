import { describe, it, expect } from 'vitest';
import { formatAnthropicStreamEvents } from '../../../src/gateway/stream.js';

describe('Claude Code – Anthropic message format compatibility', () => {
  it('should produce a message_start event with type=message and role=assistant', () => {
    const events = formatAnthropicStreamEvents('msg-abc', 'Hello');
    const startEvent = events.find(e => e.includes('event: message_start'));
    expect(startEvent).toBeDefined();

    const dataLine = startEvent!.split('\n').find(l => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.replace('data: ', ''));

    expect(parsed.type).toBe('message_start');
    expect(parsed.message.type).toBe('message');
    expect(parsed.message.role).toBe('assistant');
  });

  it('should include content blocks in the streamed output', () => {
    const events = formatAnthropicStreamEvents('msg-abc', 'Hello world');
    const blockStart = events.find(e => e.includes('event: content_block_start'));
    expect(blockStart).toBeDefined();

    const dataLine = blockStart!.split('\n').find(l => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.replace('data: ', ''));

    expect(parsed.type).toBe('content_block_start');
    expect(parsed.content_block.type).toBe('text');
  });

  it('should set stop_reason=end_turn in the message_delta event', () => {
    const events = formatAnthropicStreamEvents('msg-abc', 'Hello');
    const deltaEvent = events.find(e => e.includes('event: message_delta'));
    expect(deltaEvent).toBeDefined();

    const dataLine = deltaEvent!.split('\n').find(l => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.replace('data: ', ''));

    expect(parsed.type).toBe('message_delta');
    expect(parsed.delta.stop_reason).toBe('end_turn');
  });

  it('should terminate with a message_stop event', () => {
    const events = formatAnthropicStreamEvents('msg-abc', 'Hello');
    const stopEvent = events.find(e => e.includes('event: message_stop'));
    expect(stopEvent).toBeDefined();

    const dataLine = stopEvent!.split('\n').find(l => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.replace('data: ', ''));

    expect(parsed.type).toBe('message_stop');
  });

  it('should emit content_block_delta events that carry the full text when concatenated', () => {
    const content = 'The quick brown fox jumps over the lazy dog';
    const events = formatAnthropicStreamEvents('msg-abc', content);
    const deltaEvents = events.filter(e => e.includes('event: content_block_delta'));

    const collected = deltaEvents.map(e => {
      const dataLine = e.split('\n').find(l => l.startsWith('data: '))!;
      const parsed = JSON.parse(dataLine.replace('data: ', ''));
      return parsed.delta.text as string;
    }).join('');

    expect(collected).toBe(content);
  });

  it('should include usage output_tokens in message_delta', () => {
    const events = formatAnthropicStreamEvents('msg-abc', 'Hello world');
    const deltaEvent = events.find(e => e.includes('event: message_delta'))!;
    const dataLine = deltaEvent.split('\n').find(l => l.startsWith('data: '))!;
    const parsed = JSON.parse(dataLine.replace('data: ', ''));

    expect(parsed.usage).toBeDefined();
    expect(typeof parsed.usage.output_tokens).toBe('number');
    expect(parsed.usage.output_tokens).toBeGreaterThan(0);
  });
});
