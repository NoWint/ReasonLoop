import { describe, it, expect, beforeEach } from 'vitest';
import { createMetricsRegistry, type MetricsRegistry } from '../../src/observability/metrics.js';

describe('MetricsRegistry', () => {
  let metrics: MetricsRegistry;

  beforeEach(() => {
    metrics = createMetricsRegistry();
  });

  it('should record request counts', async () => {
    metrics.incRequests({ complexity: 'high', passthrough: 'false', status: '200' });
    metrics.incRequests({ complexity: 'low', passthrough: 'true', status: '200' });
    const output = await metrics.metrics();
    expect(output).toContain('reasonloop_requests_total');
  });

  it('should record loop iterations', async () => {
    metrics.observeLoopIterations(3, { decision: 'expand' });
    const output = await metrics.metrics();
    expect(output).toContain('reasonloop_loop_iterations');
  });

  it('should record loop duration', async () => {
    metrics.observeLoopDuration(1.5, { complexity: 'high' });
    const output = await metrics.metrics();
    expect(output).toContain('reasonloop_loop_duration_seconds');
  });

  it('should record model tokens', async () => {
    metrics.incModelTokens(100, { provider: 'openai', type: 'input' });
    const output = await metrics.metrics();
    expect(output).toContain('reasonloop_model_tokens_total');
  });

  it('should record validation results', async () => {
    metrics.incValidationResults({ source: 'code', passed: 'true' });
    const output = await metrics.metrics();
    expect(output).toContain('reasonloop_validation_results');
  });
});
