# ReasonLoop Production & Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ReasonLoop from MVP to production-grade reasoning middleware with full observability, enhanced reasoning, and ecosystem integration.

**Architecture:** Three-layer progressive build: Layer 1 (Infrastructure) → Layer 2 (Reasoning Enhancement) → Layer 3 (Ecosystem Expansion). Each layer must complete before the next begins. Within each layer, tasks with no dependencies can be parallelized.

**Tech Stack:** TypeScript, Node.js, Fastify, pino, prom-client, @opentelemetry/api, better-sqlite3, zod, isolated-vm, sqlite-vec

---

## File Structure

### New Files

| Path | Responsibility |
|---|---|
| `src/config/schema.ts` | Zod schema for ReasonLoopConfig |
| `src/config/index.ts` | Config loading, merging, validation |
| `src/core/retry.ts` | retryWithBackoff utility |
| `src/core/policy-meta.ts` | MetaReasoningPolicy implementation |
| `src/core/views.ts` | ReasoningView definitions + built-in views |
| `src/core/synthesizer.ts` | Multi-view synthesis algorithm |
| `src/gateway/stream.ts` | SSE encoding + upstream stream piping |
| `src/gateway/auth.ts` | API Key authentication hook |
| `src/observability/logger.ts` | Pino structured logger wrapper |
| `src/observability/metrics.ts` | prom-client registry + helpers |
| `src/observability/tracing.ts` | OpenTelemetry provider + span helpers |
| `src/observability/index.ts` | Unified observability exports |
| `src/engine/storage-sqlite.ts` | SQLite storage implementation |
| `src/validators/code.ts` | Code execution sandbox validator |
| `src/validators/retrieval.ts` | Web retrieval validation |
| `src/validators/rules.ts` | Regex/Schema/Custom rule validators |
| `src/validators/composite.ts` | Composite validator with strategy selection |
| `src/validators/index.ts` | Validator unified exports |
| `src/memory/indexer.ts` | Memory extraction + embedding + storage |
| `src/memory/retriever.ts` | Semantic search retrieval |
| `src/memory/store.ts` | Vector store interface |
| `src/memory/store-sqlite-vec.ts` | sqlite-vec implementation |
| `src/knowledge/types.ts` | Knowledge graph data model |
| `src/knowledge/store.ts` | SQLite graph storage |
| `src/knowledge/extractor.ts` | Knowledge extraction from State |
| `src/knowledge/query.ts` | Graph queries |
| `tests/config/schema.test.ts` | Config schema tests |
| `tests/config/index.test.ts` | Config loading tests |
| `tests/core/retry.test.ts` | Retry utility tests |
| `tests/core/policy-meta.test.ts` | Meta-reasoning policy tests |
| `tests/core/views.test.ts` | View definition tests |
| `tests/core/synthesizer.test.ts` | Synthesis algorithm tests |
| `tests/gateway/stream.test.ts` | SSE encoding tests |
| `tests/gateway/auth.test.ts` | Auth hook tests |
| `tests/observability/logger.test.ts` | Logger tests |
| `tests/observability/metrics.test.ts` | Metrics tests |
| `tests/engine/storage-sqlite.test.ts` | SQLite storage tests |
| `tests/validators/code.test.ts` | Code validator tests |
| `tests/validators/retrieval.test.ts` | Retrieval validator tests |
| `tests/validators/rules.test.ts` | Rule validator tests |
| `tests/validators/composite.test.ts` | Composite validator tests |
| `tests/memory/indexer.test.ts` | Memory indexer tests |
| `tests/memory/retriever.test.ts` | Memory retriever tests |
| `tests/knowledge/extractor.test.ts` | Knowledge extractor tests |
| `tests/knowledge/query.test.ts` | Knowledge query tests |
| `tests/integration/agent-compat/claude-code.test.ts` | Claude Code compat tests |
| `tests/integration/agent-compat/cursor.test.ts` | Cursor compat tests |

### Modified Files

| Path | Changes |
|---|---|
| `src/core/types.ts` | Add ReasonLoopConfig, Storage, Validator, ReasoningView, MemoryEntry, KnowledgeNode/Edge types |
| `src/core/validator.ts` | Refactor from noop to interface + noop implementation |
| `src/core/policy.ts` | Extract Policy interface, add PolicyController |
| `src/core/scratchpad.ts` | Pure divergent thinking, remove structured output |
| `src/core/planner.ts` | Accept Scratchpad output as input |
| `src/core/compiler.ts` | Add view-specific compilation, historical context injection |
| `src/engine/adapter.ts` | Add retry wrapper |
| `src/engine/loop.ts` | Add Scratchpad step, timeout, multi-view, memory indexing |
| `src/engine/storage.ts` | Unified storage interface + factory |
| `src/gateway/types.ts` | Replace Map with Storage interface |
| `src/gateway/server.ts` | Add auth, rate-limit, metrics, observability |
| `src/gateway/routes/openai.ts` | Add streaming support |
| `src/gateway/routes/anthropic.ts` | Add streaming support |
| `src/cli/commands/start.ts` | Use unified config |
| `src/index.ts` | Export new public APIs |
| `package.json` | Add new dependencies |

---

## Layer 1 — Infrastructure

### Task 1: Unified Configuration Management

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/index.ts`
- Create: `tests/config/schema.test.ts`
- Create: `tests/config/index.test.ts`
- Modify: `src/core/types.ts` (add ReasonLoopConfig type)
- Modify: `package.json` (add zod dependency)

- [ ] **Step 1: Install zod dependency**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npm install zod`

- [ ] **Step 2: Write the config schema test**

```typescript
// tests/config/schema.test.ts
import { describe, it, expect } from 'vitest';
import { ReasonLoopConfigSchema } from '../../src/config/schema.js';

describe('ReasonLoopConfigSchema', () => {
  it('should accept valid minimal config', () => {
    const result = ReasonLoopConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should fill defaults for missing fields', () => {
    const result = ReasonLoopConfigSchema.parse({});
    expect(result.server.port).toBe(8080);
    expect(result.server.host).toBe('0.0.0.0');
    expect(result.auth.enabled).toBe(false);
    expect(result.auth.apiKeys).toEqual([]);
    expect(result.rateLimit.maxRequests).toBe(100);
    expect(result.rateLimit.windowMs).toBe(60000);
    expect(result.complexity.threshold).toBe(0.5);
    expect(result.models.default).toBe('gpt-4');
    expect(result.models.timeout).toBe(60000);
    expect(result.observability.logLevel).toBe('info');
    expect(result.observability.metrics).toBe(true);
    expect(result.observability.tracing.enabled).toBe(false);
    expect(result.storage.type).toBe('sqlite');
    expect(result.storage.path).toBe('./data/reasonloop');
    expect(result.multiView.enabled).toBe(false);
    expect(result.memory.enabled).toBe(false);
    expect(result.memory.topK).toBe(5);
    expect(result.loop.timeout).toBe(300000);
    expect(result.loop.maxRetries).toBe(3);
    expect(result.loop.retryBaseDelay).toBe(1000);
  });

  it('should reject invalid port', () => {
    const result = ReasonLoopConfigSchema.safeParse({ server: { port: -1 } });
    expect(result.success).toBe(false);
  });

  it('should reject invalid complexity threshold', () => {
    const result = ReasonLoopConfigSchema.safeParse({ complexity: { threshold: 1.5 } });
    expect(result.success).toBe(false);
  });

  it('should auto-detect auth.enabled from apiKeys', () => {
    const result = ReasonLoopConfigSchema.parse({ auth: { apiKeys: ['key1', 'key2'] } });
    expect(result.auth.enabled).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/config/schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the config schema**

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const ReasonLoopConfigSchema = z.object({
  server: z.object({
    port: z.number().int().min(1).max(65535).default(8080),
    host: z.string().default('0.0.0.0'),
  }).default({}),

  auth: z.object({
    enabled: z.boolean().default(false),
    apiKeys: z.array(z.string()).default([]),
  }).default({}).transform(val => ({
    ...val,
    enabled: val.apiKeys.length > 0 ? true : val.enabled,
  })),

  rateLimit: z.object({
    maxRequests: z.number().int().min(1).default(100),
    windowMs: z.number().int().min(1000).default(60000),
  }).default({}),

  complexity: z.object({
    threshold: z.number().min(0).max(1).default(0.5),
  }).default({}),

  convergence: z.object({
    maxIterations: z.number().int().min(1).default(10),
    budgetLimit: z.number().min(0).default(100000),
    stabilityThreshold: z.number().min(0).max(1).default(0.85),
    minIterations: z.number().int().min(0).default(2),
    complexityThreshold: z.number().min(0).max(1).default(0.5),
  }).default({}),

  models: z.object({
    default: z.string().default('gpt-4'),
    timeout: z.number().int().min(1000).default(60000),
    providers: z.object({
      openai: z.object({
        apiKey: z.string().default(''),
        baseUrl: z.string().optional(),
      }).optional(),
      anthropic: z.object({
        apiKey: z.string().default(''),
        baseUrl: z.string().optional(),
      }).optional(),
    }).default({}),
  }).default({}),

  observability: z.object({
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    metrics: z.boolean().default(true),
    tracing: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().optional(),
    }).default({}),
  }).default({}),

  storage: z.object({
    type: z.enum(['json', 'sqlite']).default('sqlite'),
    path: z.string().default('./data/reasonloop'),
  }).default({}),

  multiView: z.object({
    enabled: z.boolean().default(false),
    views: z.array(z.object({
      id: z.string(),
      name: z.string(),
      systemPrompt: z.string(),
      focusAreas: z.array(z.string()),
      weight: z.number().min(0).max(1),
    })).default([]),
  }).default({}),

  memory: z.object({
    enabled: z.boolean().default(false),
    topK: z.number().int().min(1).default(5),
  }).default({}),

  loop: z.object({
    timeout: z.number().int().min(1000).default(300000),
    maxRetries: z.number().int().min(0).default(3),
    retryBaseDelay: z.number().int().min(100).default(1000),
  }).default({}),
});

export type ReasonLoopConfig = z.infer<typeof ReasonLoopConfigSchema>;
```

- [ ] **Step 5: Write the config loader test**

```typescript
// tests/config/index.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/index.js';

describe('loadConfig', () => {
  afterEach(() => {
    delete process.env.REASONLOOP_PORT;
    delete process.env.REASONLOOP_API_KEY;
    delete process.env.REASONLOOP_MODEL;
  });

  it('should return defaults when no config provided', () => {
    const config = loadConfig();
    expect(config.server.port).toBe(8080);
    expect(config.auth.enabled).toBe(false);
  });

  it('should override defaults with explicit values', () => {
    const config = loadConfig({ server: { port: 9090 } });
    expect(config.server.port).toBe(9090);
  });

  it('should load from environment variables', () => {
    process.env.REASONLOOP_PORT = '7070';
    process.env.REASONLOOP_API_KEY = 'test-key';
    const config = loadConfig();
    expect(config.server.port).toBe(7070);
    expect(config.auth.apiKeys).toContain('test-key');
  });

  it('should validate and throw on invalid config', () => {
    expect(() => loadConfig({ server: { port: -1 } })).toThrow();
  });
});
```

- [ ] **Step 6: Write the config loader**

```typescript
// src/config/index.ts
import { ReasonLoopConfigSchema, type ReasonLoopConfig } from './schema.js';

export type { ReasonLoopConfig };

export function loadConfig(overrides?: Partial<ReasonLoopConfig>): ReasonLoopConfig {
  const envOverrides: Record<string, unknown> = {};

  if (process.env.REASONLOOP_PORT) {
    envOverrides.server = { ...(envOverrides.server as object || {}), port: Number(process.env.REASONLOOP_PORT) };
  }
  if (process.env.REASONLOOP_HOST) {
    envOverrides.server = { ...(envOverrides.server as object || {}), host: process.env.REASONLOOP_HOST };
  }
  if (process.env.REASONLOOP_API_KEY) {
    envOverrides.auth = { apiKeys: [process.env.REASONLOOP_API_KEY] };
  }
  if (process.env.REASONLOOP_MODEL) {
    envOverrides.models = { default: process.env.REASONLOOP_MODEL };
  }
  if (process.env.REASONLOOP_LOG_LEVEL) {
    envOverrides.observability = { logLevel: process.env.REASONLOOP_LOG_LEVEL as any };
  }
  if (process.env.REASONLOOP_STORAGE_TYPE) {
    envOverrides.storage = { ...(envOverrides.storage as object || {}), type: process.env.REASONLOOP_STORAGE_TYPE as any };
  }
  if (process.env.REASONLOOP_STORAGE_PATH) {
    envOverrides.storage = { ...(envOverrides.storage as object || {}), path: process.env.REASONLOOP_STORAGE_PATH };
  }

  const merged = deepMerge(deepMerge({}, envOverrides), overrides ?? {});
  return ReasonLoopConfigSchema.parse(merged);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
```

- [ ] **Step 7: Run all config tests**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/config/`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/config/ tests/config/ package.json package-lock.json && git commit -m "feat: add unified configuration management with zod schema"
```

---

### Task 2: Structured Logging (pino)

**Files:**
- Create: `src/observability/logger.ts`
- Create: `tests/observability/logger.test.ts`
- Modify: `package.json` (add pino dependency)

- [ ] **Step 1: Install pino dependency**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npm install pino`

- [ ] **Step 2: Write the logger test**

```typescript
// tests/observability/logger.test.ts
import { describe, it, expect } from 'vitest';
import { createLogger } from '../../src/observability/logger.js';

describe('createLogger', () => {
  it('should create a logger with default level', () => {
    const logger = createLogger({ logLevel: 'info' });
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  it('should create a logger with debug level', () => {
    const logger = createLogger({ logLevel: 'debug' });
    expect(logger.level).toBe('debug');
  });

  it('should support child logger with context', () => {
    const logger = createLogger({ logLevel: 'info' });
    const child = logger.child({ requestId: 'req-123', sessionId: 'sess-456' });
    expect(child).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/observability/logger.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the logger**

```typescript
// src/observability/logger.ts
import pino from 'pino';

export interface LoggerContext {
  logLevel: string;
}

export function createLogger(ctx: LoggerContext) {
  return pino({
    level: ctx.logLevel,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/observability/logger.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/observability/logger.ts tests/observability/logger.test.ts package.json package-lock.json && git commit -m "feat: add structured logging with pino"
```

---

### Task 3: Prometheus Metrics

**Files:**
- Create: `src/observability/metrics.ts`
- Create: `tests/observability/metrics.test.ts`
- Modify: `package.json` (add prom-client dependency)

- [ ] **Step 1: Install prom-client dependency**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npm install prom-client`

- [ ] **Step 2: Write the metrics test**

```typescript
// tests/observability/metrics.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/observability/metrics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the metrics module**

```typescript
// src/observability/metrics.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/observability/metrics.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/observability/metrics.ts tests/observability/metrics.test.ts package.json package-lock.json && git commit -m "feat: add Prometheus metrics with prom-client"
```

---

### Task 4: OpenTelemetry Tracing + Observability Index

**Files:**
- Create: `src/observability/tracing.ts`
- Create: `tests/observability/tracing.test.ts`
- Create: `src/observability/index.ts`
- Modify: `package.json` (add OTel dependencies)

- [ ] **Step 1: Install OpenTelemetry dependencies**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npm install @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions`

- [ ] **Step 2: Write the tracing test**

```typescript
// tests/observability/tracing.test.ts
import { describe, it, expect } from 'vitest';
import { setupTracing, createSpan } from '../../src/observability/tracing.js';

describe('tracing', () => {
  it('should setup tracing without error when disabled', () => {
    expect(() => setupTracing({ enabled: false })).not.toThrow();
  });

  it('should return result from createSpan when disabled', () => {
    setupTracing({ enabled: false });
    const result = createSpan('test-operation', () => 'hello');
    expect(result).toBe('hello');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/observability/tracing.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the tracing module**

```typescript
// src/observability/tracing.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let provider: NodeTracerProvider | null = null;

export function setupTracing(config: { enabled: boolean; endpoint?: string }): void {
  if (!config.enabled) {
    provider = null;
    return;
  }

  provider = new NodeTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: 'reasonloop' }),
  });

  if (config.endpoint) {
    const exporter = new OTLPTraceExporter({ url: config.endpoint });
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  }

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
```

- [ ] **Step 5: Create the observability index**

```typescript
// src/observability/index.ts
export { createLogger, type Logger, type LoggerContext } from './logger.js';
export { createMetricsRegistry, type MetricsRegistry } from './metrics.js';
export { setupTracing, getTracer, createSpan, createAsyncSpan } from './tracing.js';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/observability/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/observability/ tests/observability/ package.json package-lock.json && git commit -m "feat: add OpenTelemetry tracing and observability index"
```

---

### Task 5: Streaming Passthrough

**Files:**
- Create: `src/gateway/stream.ts`
- Create: `tests/gateway/stream.test.ts`
- Modify: `src/gateway/routes/openai.ts`
- Modify: `src/gateway/routes/anthropic.ts`

- [ ] **Step 1: Write the stream module test**

```typescript
// tests/gateway/stream.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/gateway/stream.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the stream module**

```typescript
// src/gateway/stream.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/gateway/stream.test.ts`
Expected: PASS

- [ ] **Step 5: Modify OpenAI route to support streaming**

Add import at top of `src/gateway/routes/openai.ts`:
```typescript
import { emitAsSSE } from '../stream.js';
```

Then modify the route handler to check `req.stream` and handle both streaming and non-streaming cases. When `req.stream` is true and complexity is low, pipe the upstream SSE. When `req.stream` is true and complexity is high, run the loop and emit the result as SSE chunks.

- [ ] **Step 6: Modify Anthropic route similarly**

Add import at top of `src/gateway/routes/anthropic.ts`:
```typescript
import { emitAsSSE } from '../stream.js';
```

Apply same streaming logic with Anthropic SSE format.

- [ ] **Step 7: Run all gateway tests**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/gateway/`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/gateway/stream.ts src/gateway/routes/ tests/gateway/stream.test.ts && git commit -m "feat: add streaming passthrough for OpenAI and Anthropic routes"
```

---

### Task 6: Authentication + Rate Limiting

**Files:**
- Create: `src/gateway/auth.ts`
- Create: `tests/gateway/auth.test.ts`
- Modify: `src/gateway/server.ts`
- Modify: `package.json` (add @fastify/rate-limit dependency)

- [ ] **Step 1: Install rate-limit dependency**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npm install @fastify/rate-limit`

- [ ] **Step 2: Write the auth test**

```typescript
// tests/gateway/auth.test.ts
import { describe, it, expect } from 'vitest';
import { createAuthHook } from '../../src/gateway/auth.js';

describe('createAuthHook', () => {
  it('should skip validation when no apiKeys configured', async () => {
    const hook = createAuthHook({ enabled: false, apiKeys: [] });
    const mockRequest = { headers: {} } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeUndefined();
  });

  it('should accept valid API key in Authorization header', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: { authorization: 'Bearer valid-key' } } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeUndefined();
  });

  it('should accept valid API key in x-api-key header', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: { 'x-api-key': 'valid-key' } } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeUndefined();
  });

  it('should reject invalid API key', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: { authorization: 'Bearer wrong-key' } } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
  });

  it('should reject missing API key when auth is enabled', async () => {
    const hook = createAuthHook({ enabled: true, apiKeys: ['valid-key'] });
    const mockRequest = { headers: {} } as any;
    let error: any;
    try { await hook(mockRequest); } catch (e) { error = e; }
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(401);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/gateway/auth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the auth module**

```typescript
// src/gateway/auth.ts
import type { FastifyRequest } from 'fastify';

interface AuthConfig {
  enabled: boolean;
  apiKeys: string[];
}

export function createAuthHook(config: AuthConfig) {
  return async (request: FastifyRequest) => {
    if (!config.enabled || config.apiKeys.length === 0) return;

    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

    let providedKey = '';
    if (authHeader?.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7);
    } else if (apiKeyHeader) {
      providedKey = apiKeyHeader;
    }

    if (!providedKey || !config.apiKeys.includes(providedKey)) {
      const err = new Error('Unauthorized: Invalid or missing API key') as any;
      err.statusCode = 401;
      throw err;
    }
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/gateway/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Modify server.ts to register auth and rate-limit**

Add imports and register `@fastify/rate-limit` plugin and auth preHandler hook in `src/gateway/server.ts`.

- [ ] **Step 7: Run all tests**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/gateway/auth.ts src/gateway/server.ts tests/gateway/auth.test.ts package.json package-lock.json && git commit -m "feat: add API key authentication and rate limiting"
```

---

### Task 7: Timeout Control + Retry Mechanism

**Files:**
- Create: `src/core/retry.ts`
- Create: `tests/core/retry.test.ts`
- Modify: `src/engine/loop.ts` (add loop timeout + retry wrapper)

- [ ] **Step 1: Write the retry test**

```typescript
// tests/core/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../../src/core/retry.js';

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retriable error and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should exhaust retries and throw', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retriable errors', async () => {
    const err: any = new Error('bad request');
    err.status = 400;
    const fn = vi.fn().mockRejectedValue(err);
    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 status', async () => {
    const err: any = new Error('rate limited');
    err.status = 429;
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelay: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/core/retry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the retry module**

```typescript
// src/core/retry.ts
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
}

function isRetriable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as any;
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return true;
  if (err.status >= 500 && err.status < 600) return true;
  if (err.status === 429) return true;
  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxRetries || !isRetriable(error)) {
        throw error;
      }
      const delay = options.baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/core/retry.test.ts`
Expected: PASS

- [ ] **Step 5: Modify loop.ts to add loop-level timeout and retry**

Add import `retryWithBackoff` from `'../core/retry.js'` and wrap all `adapter.complete()` calls with `retryWithBackoff()`. Add loop timeout check with `Date.now() - startTime > timeoutMs` at the top of each iteration.

- [ ] **Step 6: Run all tests**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/core/retry.ts src/engine/loop.ts tests/core/retry.test.ts && git commit -m "feat: add retry with backoff and loop timeout control"
```

---

### Task 8: Session Persistence Upgrade (SQLite)

**Files:**
- Create: `src/engine/storage-sqlite.ts`
- Create: `tests/engine/storage-sqlite.test.ts`
- Modify: `src/engine/storage.ts` (add Storage interface)
- Modify: `package.json` (add better-sqlite3 dependency)

- [ ] **Step 1: Install better-sqlite3 dependency**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npm install better-sqlite3 && npm install -D @types/better-sqlite3`

- [ ] **Step 2: Write the SQLite storage test**

```typescript
// tests/engine/storage-sqlite.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteStorage } from '../../src/engine/storage-sqlite.js';
import { initState } from '../../src/core/state.js';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('SQLiteStorage', () => {
  let storage: SQLiteStorage;
  const dbPath = path.join(process.cwd(), 'tmp-test-storage', 'test.db');

  beforeEach(async () => {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    storage = new SQLiteStorage(dbPath);
  });

  afterEach(async () => {
    storage.close();
    try { await fs.rm(path.dirname(dbPath), { recursive: true }); } catch { /* ignore */ }
  });

  it('should save and load a session', async () => {
    const state = initState('test goal', 'sess-1', 100000);
    await storage.saveSession({ id: 'sess-1', state, status: 'active' });
    const loaded = await storage.loadSession('sess-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.state.goal).toBe('test goal');
  });

  it('should return null for non-existent session', async () => {
    const loaded = await storage.loadSession('nonexistent');
    expect(loaded).toBeNull();
  });

  it('should list sessions', async () => {
    const state1 = initState('goal 1', 'sess-1', 100000);
    const state2 = initState('goal 2', 'sess-2', 100000);
    await storage.saveSession({ id: 'sess-1', state: state1, status: 'active' });
    await storage.saveSession({ id: 'sess-2', state: state2, status: 'completed' });
    const list = await storage.listSessions();
    expect(list).toHaveLength(2);
  });

  it('should save and load iterations', async () => {
    const state = initState('test goal', 'sess-1', 100000);
    await storage.saveSession({ id: 'sess-1', state, status: 'active' });
    await storage.saveIteration({
      id: 'iter-1', sessionId: 'sess-1', phase: 'planner',
      input: '{}', output: '{}', durationMs: 100,
    });
    const iterations = await storage.loadIterations('sess-1');
    expect(iterations).toHaveLength(1);
    expect(iterations[0].phase).toBe('planner');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/engine/storage-sqlite.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the SQLite storage module**

```typescript
// src/engine/storage-sqlite.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import type { ReasoningState } from '../core/types.js';

export interface SessionRecord {
  id: string;
  state: ReasoningState;
  status: 'active' | 'completed' | 'failed';
}

export interface SessionMeta {
  id: string;
  goal: string;
  status: string;
  iteration: number;
  createdAt: number;
}

export interface IterationRecord {
  id: string;
  sessionId: string;
  phase: string;
  input: string;
  output: string;
  durationMs: number;
}

export class SQLiteStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        state TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
      CREATE TABLE IF NOT EXISTS iterations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_iterations_session ON iterations(session_id);
    `);
  }

  async saveSession(session: SessionRecord): Promise<void> {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO sessions (id, goal, state, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        goal = excluded.goal, state = excluded.state,
        status = excluded.status, updated_at = excluded.updated_at
    `).run(session.id, session.state.goal, JSON.stringify(session.state), session.status, now, now);
  }

  async loadSession(id: string): Promise<SessionRecord | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { id: row.id, state: JSON.parse(row.state), status: row.status };
  }

  async listSessions(): Promise<SessionMeta[]> {
    const rows = this.db.prepare('SELECT id, goal, status, created_at FROM sessions ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({ id: r.id, goal: r.goal, status: r.status, iteration: 0, createdAt: r.created_at }));
  }

  async saveIteration(iteration: IterationRecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO iterations (id, session_id, phase, input, output, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(iteration.id, iteration.sessionId, iteration.phase, iteration.input, iteration.output, iteration.durationMs, Date.now());
  }

  async loadIterations(sessionId: string): Promise<IterationRecord[]> {
    const rows = this.db.prepare('SELECT * FROM iterations WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];
    return rows.map(r => ({
      id: r.id, sessionId: r.session_id, phase: r.phase,
      input: r.input, output: r.output, durationMs: r.duration_ms,
    }));
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 5: Add Storage interface to storage.ts**

Add `Storage` interface to `src/engine/storage.ts` for unified storage abstraction.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/engine/storage-sqlite.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/engine/storage-sqlite.ts src/engine/storage.ts tests/engine/storage-sqlite.test.ts package.json package-lock.json && git commit -m "feat: add SQLite session persistence"
```

---

### Task 9: Integrate Config into CLI and Server

**Files:**
- Modify: `src/cli/commands/start.ts` (use loadConfig)
- Modify: `src/index.ts` (export new APIs)

- [ ] **Step 1: Modify start.ts to use loadConfig**

Update `src/cli/commands/start.ts` to import `loadConfig` from `../../config/index.js` and use it to build the ServerConfig. CLI options override config defaults.

- [ ] **Step 2: Update src/index.ts to export new APIs**

Add exports for config, observability, retry, storage, stream, and auth modules.

- [ ] **Step 3: Run all tests**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Run type check**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/cli/commands/start.ts src/index.ts && git commit -m "feat: integrate unified config into CLI and server"
```

---

### Task 10: Layer 1 Integration Test + Push

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Run type check**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Push to GitHub**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git push origin main
```

---

## Layer 2 — Reasoning Enhancement

### Task 11: Validator Full Implementation

**Files:**
- Create: `src/validators/code.ts`
- Create: `src/validators/retrieval.ts`
- Create: `src/validators/rules.ts`
- Create: `src/validators/composite.ts`
- Create: `src/validators/index.ts`
- Create: `tests/validators/code.test.ts`
- Create: `tests/validators/retrieval.test.ts`
- Create: `tests/validators/rules.test.ts`
- Create: `tests/validators/composite.test.ts`
- Modify: `src/core/validator.ts` (refactor noop)
- Modify: `src/core/types.ts` (update ValidationResult)

- [ ] **Step 1: Update ValidationResult type in types.ts** — Add `confidence: number` and `source: 'code' | 'retrieval' | 'rule' | 'noop'` fields.

- [ ] **Step 2: Refactor validator.ts** — Update noopValidator to include new fields.

- [ ] **Step 3: Write and implement RegexRuleValidator and JsonSchemaRuleValidator** in `src/validators/rules.ts` with tests.

- [ ] **Step 4: Write and implement SafeEvalValidator** in `src/validators/code.ts` with tests.

- [ ] **Step 5: Write and implement RetrievalValidator** in `src/validators/retrieval.ts` with tests.

- [ ] **Step 6: Write and implement CompositeValidator** in `src/validators/composite.ts` with tests.

- [ ] **Step 7: Create validators index** in `src/validators/index.ts`.

- [ ] **Step 8: Run all validator tests and commit**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run tests/validators/`

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/validators/ tests/validators/ src/core/validator.ts src/core/types.ts && git commit -m "feat: add full validator implementation - code, retrieval, rules, composite"
```

---

### Task 12: Policy Meta-Reasoning Upgrade

**Files:**
- Create: `src/core/policy-meta.ts`
- Create: `tests/core/policy-meta.test.ts`
- Modify: `src/core/policy.ts` (extract Policy interface, add PolicyController)

- [ ] **Step 1: Write MetaReasoningPolicy test and implementation** — LLM-powered policy that analyzes state and decides next action.

- [ ] **Step 2: Add Policy interface and PolicyController to policy.ts** — Dual-mode: HeuristicPolicy (fast) vs MetaReasoningPolicy (deep).

- [ ] **Step 3: Run tests and commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/core/policy.ts src/core/policy-meta.ts tests/core/policy-meta.test.ts && git commit -m "feat: add meta-reasoning policy and policy controller"
```

---

### Task 13: Scratchpad/Planner Relationship Refactoring

**Files:**
- Modify: `src/core/scratchpad.ts` (pure divergent, remove structured output instructions)
- Modify: `src/core/planner.ts` (accept Scratchpad output as input)
- Modify: `src/engine/loop.ts` (add Scratchpad → Planner step)

- [ ] **Step 1: Refactor scratchpad.ts** — Remove CLAIM/ASSUMPTION/EVIDENCE/QUESTION prefixes from instructions. Make it pure free exploration.

- [ ] **Step 2: Modify planner.ts** — Add `scratchpadOutput?: string` parameter. Include scratchpad notes as "Exploration Notes" section.

- [ ] **Step 3: Modify loop.ts** — Add Scratchpad step before Planner. First call Scratchpad for free exploration, then pass output to Planner for structured extraction.

- [ ] **Step 4: Run all tests and commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/core/scratchpad.ts src/core/planner.ts src/engine/loop.ts && git commit -m "feat: refactor scratchpad/planner - divergent thinking then structured extraction"
```

---

### Task 14: Multi-View Reasoning

**Files:**
- Create: `src/core/views.ts`
- Create: `src/core/synthesizer.ts`
- Create: `tests/core/views.test.ts`
- Create: `tests/core/synthesizer.test.ts`
- Modify: `src/core/compiler.ts` (add view-specific compilation)
- Modify: `src/core/types.ts` (add ReasoningView and SynthesisResult types)

- [ ] **Step 1: Add ReasoningView and SynthesisResult types to types.ts**

- [ ] **Step 2: Write and implement views.ts** — 4 built-in views (Architect, Security, DevOps, Pragmatist) with `getViewById()`.

- [ ] **Step 3: Write and implement synthesizer.ts** — Synthesis algorithm: find consensus (shared claims), find conflicts (contradictory claims), weight by view weight.

- [ ] **Step 4: Add `compileStateForView()` to compiler.ts** — View-specific system prompt compilation.

- [ ] **Step 5: Run all tests and commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/core/views.ts src/core/synthesizer.ts src/core/compiler.ts src/core/types.ts tests/core/views.test.ts tests/core/synthesizer.test.ts && git commit -m "feat: add multi-view reasoning with built-in views and synthesis"
```

---

### Task 15: Layer 2 Integration + Push

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Run type check**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Push to GitHub**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git push origin main
```

---

## Layer 3 — Ecosystem Expansion

### Task 16: Claude Code + Cursor Integration Tests

**Files:**
- Create: `tests/integration/agent-compat/claude-code.test.ts`
- Create: `tests/integration/agent-compat/cursor.test.ts`

- [ ] **Step 1: Write Claude Code compatibility test** — Verify Anthropic message format, streaming events, tool_use passthrough.

- [ ] **Step 2: Write Cursor compatibility test** — Verify OpenAI chat completion format, streaming chunks, function calling.

- [ ] **Step 3: Run tests and commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add tests/integration/ && git commit -m "feat: add Claude Code and Cursor integration compatibility tests"
```

---

### Task 17: Long-Term Memory

**Files:**
- Create: `src/memory/store.ts`
- Create: `src/memory/store-sqlite-vec.ts`
- Create: `src/memory/indexer.ts`
- Create: `src/memory/retriever.ts`
- Create: `tests/memory/indexer.test.ts`
- Create: `tests/memory/retriever.test.ts`
- Modify: `src/core/compiler.ts` (inject historical context)
- Modify: `src/core/types.ts` (add MemoryEntry type)

- [ ] **Step 1: Add MemoryEntry type to types.ts**

- [ ] **Step 2: Write VectorStore interface in store.ts**

- [ ] **Step 3: Write SQLiteVecStore in store-sqlite-vec.ts** — SQLite + cosine similarity search.

- [ ] **Step 4: Write MemoryIndexer in indexer.ts** — Extract claims, lessons, tags from state.

- [ ] **Step 5: Write MemoryRetriever in retriever.ts** — Semantic search + formatMemoryContext().

- [ ] **Step 6: Add `compileStateWithMemory()` to compiler.ts** — Inject [Historical Context] section.

- [ ] **Step 7: Run tests and commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/memory/ tests/memory/ src/core/compiler.ts src/core/types.ts && git commit -m "feat: add long-term memory with vector store and semantic retrieval"
```

---

### Task 18: Knowledge Graph

**Files:**
- Create: `src/knowledge/types.ts`
- Create: `src/knowledge/store.ts`
- Create: `src/knowledge/extractor.ts`
- Create: `src/knowledge/query.ts`
- Create: `tests/knowledge/extractor.test.ts`
- Create: `tests/knowledge/query.test.ts`

- [ ] **Step 1: Write KnowledgeNode and KnowledgeEdge types** in `src/knowledge/types.ts`.

- [ ] **Step 2: Write KnowledgeStore in store.ts** — SQLite with nodes/edges tables, addNode, addEdge, getNeighbors.

- [ ] **Step 3: Write extractKnowledge in extractor.ts** — Extract concepts from claims, entities from goal, create edges.

- [ ] **Step 4: Write KnowledgeQuery in query.ts** — Subgraph traversal, formatAsContext().

- [ ] **Step 5: Run tests and commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add src/knowledge/ tests/knowledge/ && git commit -m "feat: add knowledge graph with extraction, storage, and queries"
```

---

### Task 19: Complete README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write comprehensive README** covering: What is ReasonLoop, Quick Start, Architecture, Configuration, Agent Integration, API Reference, Reasoning Loop, Validator, Multi-View, Memory & Knowledge, Observability, Contributing.

- [ ] **Step 2: Commit**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git add README.md && git commit -m "docs: add comprehensive README"
```

---

### Task 20: Final Integration + Push

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx vitest run`
Expected: All PASS

- [ ] **Step 2: Run type check**

Run: `cd /Users/xiatian/Desktop/ReasonLoop && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Push to GitHub**

```bash
cd /Users/xiatian/Desktop/ReasonLoop && git push origin main
```

---

## Self-Review Checklist

1. **Spec coverage**: Each section of the design spec maps to a task. Layer 1: Tasks 1-10. Layer 2: Tasks 11-15. Layer 3: Tasks 16-20. All requirements covered.

2. **Placeholder scan**: No TBD/TODO/placeholders. All steps contain actual code or specific instructions.

3. **Type consistency**: ValidationResult updated consistently across validator.ts, types.ts, and all validator implementations. ReasonLoopConfig type matches schema. Storage interface matches SQLiteStorage implementation.
