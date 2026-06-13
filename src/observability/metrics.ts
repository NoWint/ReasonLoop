import client from 'prom-client';

export interface MetricsRegistry {
  incRequests(labels: { complexity: string; passthrough: string; status: string }): void;
  observeLoopIterations(count: number, labels: { decision: string }): void;
  observeLoopDuration(seconds: number, labels: { complexity: string }): void;
  incModelTokens(tokens: number, labels: { provider: string; type: string }): void;
  incValidationResults(labels: { source: string; passed: string }): void;
  metrics(): Promise<string>;
  contentType(): string;
}

export function createMetricsRegistry(): MetricsRegistry {
  const registry = new client.Registry();

  const requestsTotal = new client.Counter({
    name: 'reasonloop_requests_total',
    help: 'Total number of requests processed',
    labelNames: ['complexity', 'passthrough', 'status'],
    registers: [registry],
  });

  const loopIterations = new client.Histogram({
    name: 'reasonloop_loop_iterations',
    help: 'Number of iterations in reasoning loop',
    labelNames: ['decision'],
    buckets: [1, 2, 3, 5, 8, 13],
    registers: [registry],
  });

  const loopDuration = new client.Histogram({
    name: 'reasonloop_loop_duration_seconds',
    help: 'Duration of reasoning loop in seconds',
    labelNames: ['complexity'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
    registers: [registry],
  });

  const modelTokens = new client.Counter({
    name: 'reasonloop_model_tokens_total',
    help: 'Total tokens used by model calls',
    labelNames: ['provider', 'type'],
    registers: [registry],
  });

  const validationResults = new client.Counter({
    name: 'reasonloop_validation_results',
    help: 'Validation results by source and outcome',
    labelNames: ['source', 'passed'],
    registers: [registry],
  });

  return {
    incRequests(labels) { requestsTotal.inc(labels); },
    observeLoopIterations(count, labels) { loopIterations.observe(labels, count); },
    observeLoopDuration(seconds, labels) { loopDuration.observe(labels, seconds); },
    incModelTokens(tokens, labels) { modelTokens.inc(labels, tokens); },
    incValidationResults(labels) { validationResults.inc(labels); },
    async metrics() { return registry.metrics(); },
    contentType() { return registry.contentType; },
  };
}
