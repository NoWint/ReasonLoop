export function createSSEEncoder() {
  return (data: unknown): string => {
    return `data: ${JSON.stringify(data)}\n\n`;
  };
}

export function formatOpenAIStreamChunk(id: string, content: string | null): string {
  if (content === null) {
    return 'data: [DONE]\n\n';
  }
  const chunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: '',
    choices: [{
      index: 0,
      delta: { content },
      finish_reason: null,
    }],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export function formatAnthropicStreamEvents(messageId: string, content: string): string[] {
  const events: string[] = [];

  events.push(`event: message_start\ndata: ${JSON.stringify({
    type: 'message_start',
    message: { id: messageId, type: 'message', role: 'assistant', content: [], model: '', stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } },
  })}\n\n`);

  events.push(`event: content_block_start\ndata: ${JSON.stringify({
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  })}\n\n`);

  const chunkSize = 10;
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.slice(i, i + chunkSize);
    events.push(`event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: chunk },
    })}\n\n`);
  }

  events.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);

  events.push(`event: message_delta\ndata: ${JSON.stringify({
    type: 'message_delta',
    delta: { stop_reason: 'end_turn' },
    usage: { output_tokens: Math.ceil(content.length / 4) },
  })}\n\n`);

  events.push(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);

  return events;
}

export function emitAsSSE(content: string, protocol: 'openai' | 'anthropic', id: string, model: string): string[] {
  const chunks: string[] = [];

  if (protocol === 'openai') {
    const chunkSize = 20;
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(formatOpenAIStreamChunk(id, content.slice(i, i + chunkSize)));
    }
    chunks.push(formatOpenAIStreamChunk(id, null));
  } else {
    chunks.push(...formatAnthropicStreamEvents(id, content));
  }

  return chunks;
}
