import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let provider: NodeTracerProvider | null = null;

export function setupTracing(config: { enabled: boolean; endpoint?: string }): void {
  if (!config.enabled) {
    provider = null;
    return;
  }

  const spanProcessors = config.endpoint
    ? [new SimpleSpanProcessor(new OTLPTraceExporter({ url: config.endpoint }))]
    : [];

  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'reasonloop' }),
    spanProcessors,
  });

  provider.register();
}

export function getTracer() {
  return trace.getTracer('reasonloop', '0.1.0');
}

export function createSpan<T>(name: string, fn: () => T): T {
  if (!provider) return fn();
  const tracer = getTracer();
  const span = tracer.startSpan(name);
  const ctx = trace.setSpan(context.active(), span);
  return context.with(ctx, () => {
    try {
      const result = fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function createAsyncSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!provider) return fn();
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
