# ReasonLoop: MVP → Production & Expansion Design

> ReasonLoop is a reasoning middleware that sits between agents and language models, transforming raw prompts into structured, stateful, adversarially-evaluated reasoning processes before execution.

This document defines the roadmap from MVP to full production environment and ecosystem expansion, organized in three progressive layers.

***

## Roadmap Overview

```
Layer 1: Infrastructure    ← Foundation for everything
    ↓
Layer 2: Reasoning Enhancement  ← Core value upgrade
    ↓
Layer 3: Ecosystem Expansion    ← Reach and integration
```

Each layer must be completed before the next begins. Within each layer, tasks can be parallelized.

***

## Layer 1 — Infrastructure

All subsequent features depend on this layer. It provides the production-grade foundation.

### 1.1 Streaming Passthrough

**Goal**: Transparent streaming for Agents. Zero client-side changes required.

**Behavior**:

| Request Complexity    | `stream: true`                             | `stream: false`      |
| --------------------- | ------------------------------------------ | -------------------- |
| Low (passthrough)     | Pipe upstream SSE directly                 | Forward response     |
| High (reasoning loop) | Run loop synchronously, emit result as SSE | Return JSON response |

**Implementation**:

* New `src/gateway/stream.ts`:

  * `createSSEEncoder()`: Converts JSON chunks to SSE format (`data: {...}\n\n`)

  * `pipeUpstreamStream()`: Transparently forwards upstream SSE

  * `emitAsSSE()`: Wraps completed reasoning result in SSE format

* Modify `src/gateway/routes/openai.ts`:

  * Detect `stream` field in request body

  * Low complexity: `pipeUpstreamStream()`

  * High complexity: `runLoop()` → `emitAsSSE()`

* Modify `src/gateway/routes/anthropic.ts`:

  * Same logic with Anthropic SSE format (message\_start, content\_block\_start, content\_block\_delta, etc.)

**OpenAI SSE Format**:

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: [DONE]
```

**Anthropic SSE Format**:

```
event: message_start
data: {"type":"message_start","message":{...}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}
```

### 1.2 Authentication + Rate Limiting

**Authentication**: API Key verification

* Config: `auth.apiKeys: string[]`

* Request headers: `Authorization: Bearer <key>` or `x-api-key: <key>`

* If `auth.apiKeys` is empty, auth is disabled (local dev friendly)

* 401 on invalid key

**Rate Limiting**: Sliding window per API key

* Config: `rateLimit.maxRequests: number` (default: 100) + `rateLimit.windowMs: number` (default: 60000)

* Use `@fastify/rate-limit` plugin

* 429 on limit exceeded with `Retry-After` header

**Implementation**:

* New `src/gateway/auth.ts`:

  * `createAuthHook(config)`: Returns Fastify preHandler hook

  * Validates API key from request headers

  * Skips validation when `auth.apiKeys` is empty

* Modify `src/gateway/server.ts`:

  * Register `@fastify/rate-limit` plugin

  * Register auth preHandler hook

### 1.3 Full-Chain Observability

Three-layer observability stack:

```
Structured Logging (pino)
  ↓
Prometheus Metrics (prom-client)
  ↓
OpenTelemetry Traces (@opentelemetry/api)
```

**Structured Logging** (pino):

* Replace all `console.log` with pino logger

* Each log entry includes: `requestId`, `sessionId`, `phase` (planner/critic/adversary/validator/policy), `duration`, `level`

* Config: `observability.logLevel` (default: `info`)

**Prometheus Metrics** (prom-client):

| Metric                             | Type      | Labels                          |
| ---------------------------------- | --------- | ------------------------------- |
| `reasonloop_requests_total`        | Counter   | complexity, passthrough, status |
| `reasonloop_loop_iterations`       | Histogram | decision                        |
| `reasonloop_loop_duration_seconds` | Histogram | complexity                      |
| `reasonloop_model_tokens_total`    | Counter   | provider, type (input/output)   |
| `reasonloop_validation_results`    | Counter   | source, passed                  |

* New endpoint: `GET /metrics` (Prometheus scrape)

* Config: `observability.metrics` (default: `true`)

**OpenTelemetry Traces**:

* Each `/v1/chat/completions` request = 1 trace

* Spans: `complexity_analysis`, `reasoning_loop`, `planner_call`, `critic_call`, `adversary_call`, `validator_call`, `model_call`, `policy_decision`

* Config: `observability.tracing.enabled` + `observability.tracing.endpoint` (OTLP endpoint)

**Implementation**:

* New `src/observability/logger.ts`: Pino wrapper with structured fields

* New `src/observability/metrics.ts`: prom-client registry + helper functions

* New `src/observability/tracing.ts`: OTel provider + span helpers

* New `src/observability/index.ts`: Unified exports

* Modify all core/engine/gateway modules to use observability

### 1.4 Unified Configuration Management

**Current problem**: Config scattered across CLI args, env vars, and hardcoded values.

**Solution**: Single config source with layered override.

```typescript
interface ReasonLoopConfig {
  server: {
    port: number           // default: 8080
    host: string           // default: '0.0.0.0'
  }
  auth: {
    enabled: boolean       // auto-detected from apiKeys.length
    apiKeys: string[]      // default: []
  }
  rateLimit: {
    maxRequests: number    // default: 100
    windowMs: number       // default: 60000
  }
  complexity: {
    threshold: number      // default: 0.5
  }
  convergence: ConvergenceConfig
  models: {
    default: string        // default: 'gpt-4'
    timeout: number        // default: 60000 (ms)
    providers: {
      openai?: AdapterConfig
      anthropic?: AdapterConfig
    }
  }
  observability: {
    logLevel: string       // default: 'info'
    metrics: boolean       // default: true
    tracing: {
      enabled: boolean     // default: false
      endpoint?: string    // OTLP endpoint
    }
  }
  storage: {
    type: 'json' | 'sqlite'  // default: 'sqlite'
    path: string              // default: './data/reasonloop'
  }
  multiView: {
    enabled: boolean       // default: false
    views: ReasoningView[] // custom views
  }
  memory: {
    enabled: boolean       // default: false
    topK: number           // default: 5
  }
  loop: {
    timeout: number        // default: 300000 (5 min, ms)
    maxRetries: number     // default: 3
    retryBaseDelay: number // default: 1000 (ms)
  }
}
```

**Load priority**: CLI args > Environment variables > Config file (`reasonloop.config.ts`) > Defaults

**Validation**: zod schema validation on startup

**Implementation**:

* New `src/config/index.ts`: Config loading, merging, validation

* New `src/config/schema.ts`: Zod schema definition

* Modify all modules to read from unified config

### 1.5 Timeout Control + Retry Mechanism

**Timeout levels**:

| Level          | Config Key               | Default | Scope                 |
| -------------- | ------------------------ | ------- | --------------------- |
| Model call     | `models.timeout`         | 60s     | Single LLM API call   |
| Reasoning loop | `loop.timeout`           | 300s    | Entire loop execution |
| HTTP request   | Fastify `requestTimeout` | 300s    | Gateway request       |

**Retry strategy**:

* Retriable errors: network timeout, 5xx, 429 (rate limit)

* Non-retriable: 4xx (except 429), validation failures, loop internal errors

* Backoff: exponential, 1s → 2s → 4s, max 3 retries

* Config: `loop.maxRetries`, `loop.retryBaseDelay`

**Implementation**:

* New `src/core/retry.ts`: `retryWithBackoff(fn, options)` utility

* Modify `src/engine/adapter.ts`: Wrap model calls with retry

* Modify `src/engine/loop.ts`: Add loop-level timeout with `AbortController`

### 1.6 Session Persistence Upgrade

**Current**: JSON file storage, in-memory sessions lost on restart.

**Upgrade**: SQLite persistence with auto-save.

**Schema**:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  state TEXT NOT NULL,        -- JSON serialized ReasoningState
  status TEXT NOT NULL,       -- 'active' | 'completed' | 'failed'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE iterations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase TEXT NOT NULL,        -- 'planner' | 'critic' | 'adversary' | 'validator' | 'policy'
  input TEXT NOT NULL,        -- JSON
  output TEXT NOT NULL,       -- JSON
  duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**Storage interface**:

```typescript
interface Storage {
  saveSession(session: Session): Promise<void>
  loadSession(id: string): Promise<Session | null>
  listSessions(): Promise<SessionMeta[]>
  saveIteration(iteration: Iteration): Promise<void>
  loadIterations(sessionId: string): Promise<Iteration[]>
  close(): Promise<void>
}
```

**Implementation**:

* New `src/engine/storage-sqlite.ts`: SQLite implementation using `better-sqlite3`

* Modify `src/engine/storage.ts`: Unified storage interface, factory by config

* Modify `src/gateway/types.ts`: Replace `Map<string, Session>` with `Storage` interface

* Keep JSON export for `inspect` CLI command

***

## Layer 2 — Reasoning Enhancement

Builds on Layer 1's observability and infrastructure to deliver the core reasoning value.

### 2.1 Validator Full Implementation

Three validation capabilities connecting to reality:

**Code Execution Sandbox**:

```
CodeValidator
  ├─ DockerSandboxExecutor (primary)
  │   ├─ Isolated container per execution
  │   ├─ Language support: JavaScript (Node.js), Python
  │   ├─ Timeout: 10s default
  │   ├─ Memory limit: 128MB default
  │   └─ Returns: stdout, stderr, exitCode, result
  └─ SafeEvalExecutor (fallback, no Docker)
      ├─ isolated-vm for JavaScript (VM2 is deprecated)
      └─ No Python support (Docker required)
```

**Web Retrieval Validation**:

```
RetrievalValidator
  ├─ WebSearchProvider
  │   ├─ SearXNG (self-hosted, free)
  │   └─ SerpAPI (commercial, API key)
  └─ APIProbeProvider
      └─ Configurable HTTP endpoints for fact-checking
```

* Takes a Claim, searches for supporting/contradicting evidence

* Compares claim against search result snippets

* Returns confidence score based on evidence consistency

**Rule Engine**:

```
RuleValidator
  ├─ RegexRule: pattern matching on claim content
  ├─ JsonSchemaRule: structural validation of claim data
  └─ CustomAssertionRule: user-provided validation function
```

**Composite Validator**:

```typescript
interface Validator {
  validate(state: ReasoningState, claim: Claim): Promise<ValidationResult>
}

interface ValidationResult {
  passed: boolean
  confidence: number        // 0-1
  evidence: Evidence[]      // Evidence produced by validation
  details: string           // Human-readable validation report
  source: 'code' | 'retrieval' | 'rule'
}
```

Strategy selection by claim type:

* Claims about code behavior → CodeValidator

* Claims about facts/data → RetrievalValidator

* Claims about format/structure → RuleValidator

* Unknown → try all, take highest confidence

**Implementation**:

* Refactor `src/core/validator.ts`: From noop to composite validator

* New `src/validators/code.ts`: Docker sandbox + safe eval

* New `src/validators/retrieval.ts`: Web search validation

* New `src/validators/rules.ts`: Regex/Schema/Custom rules

* New `src/validators/composite.ts`: Strategy selection + result aggregation

* New `src/validators/index.ts`: Unified exports

### 2.2 Policy Meta-Reasoning Upgrade

**Current**: `decide()` uses heuristic gain/cost estimation.

**Upgrade**: Dual-mode policy with LLM-powered meta-reasoning.

```
PolicyController
  ├─ HeuristicPolicy (fast path)
  │   └─ Current implementation, no LLM calls
  └─ MetaReasoningPolicy (deep path)
      └─ LLM analyzes State, decides next step
```

**Trigger logic**:

* Iteration < 3 AND no controversies → HeuristicPolicy

* Iteration >= 3 OR controversies exist OR convergence is slow → MetaReasoningPolicy

**MetaReasoningPolicy prompt structure**:

```
System: You are a reasoning policy controller. Analyze the current reasoning state and decide the next action.

Current State:
{compiled state summary}

History:
{last 3 decisions and their outcomes}

Convergence Trend:
{stability scores over iterations}

Available Actions:
- expand: Generate new ideas and approaches
- refine: Deepen existing analysis
- verify: Validate claims against reality
- attack: Challenge current conclusions
- stop: Conclude reasoning

Output your decision and reasoning.
```

**Budget guard**: Meta-reasoning itself has a token budget (max 500 tokens per decision). No recursive meta-reasoning.

**Implementation**:

* Refactor `src/core/policy.ts`: Extract `Policy` interface, keep `HeuristicPolicy`

* New `src/core/policy-meta.ts`: `MetaReasoningPolicy` implementation

* Modify `src/core/policy.ts`: `PolicyController` selects strategy based on state

### 2.3 Scratchpad/Planner Relationship Refactoring

**Current problem**: Both Scratchpad and Planner generate "thinking content" with unclear boundaries.

**Refactored relationship**:

```
Scratchpad (Divergent Layer)
  ├─ Purpose: Free exploration, trial-and-error, guessing
  ├─ Output: Unstructured thought fragments
  ├─ Does NOT update State
  └─ Analogy: Rough notes on a whiteboard

Planner (Convergent Layer)
  ├─ Purpose: Extract structured proposals from Scratchpad
  ├─ Input: Scratchpad output + current State
  ├─ Output: Claim + Assumption + Evidence (structured)
  ├─ Updates State via Transition
  └─ Analogy: Formal proposal document
```

**Data flow in reasoning loop**:

```
Scratchpad: "What if we use event sourcing? Let me think... 
            it solves the consistency problem but adds complexity..."
    ↓ (extract structured content)
Planner: CLAIM: Event sourcing solves consistency
         ASSUMPTION: Team can handle complexity
         EVIDENCE: Consistency is a stated requirement
    ↓
Critic: ISSUE: No mention of migration strategy
    ↓
Adversary: "What if the team has only 1 developer?"
    ↓
Validator: [validates claims]
    ↓
State Update
```

**Implementation**:

* Modify `src/core/scratchpad.ts`: Pure divergent thinking, no structured output

* Modify `src/core/planner.ts`: Accept Scratchpad output as input, produce structured proposals

* Modify `src/engine/loop.ts`: Add Scratchpad → Planner step in loop

### 2.4 Multi-View Reasoning

**Core idea**: Reason about the same problem from different perspectives to discover blind spots.

**View definition**:

```typescript
interface ReasoningView {
  id: string
  name: string           // e.g., "Architect"
  systemPrompt: string   // Perspective-specific system prompt
  focusAreas: string[]   // e.g., ["scalability", "maintainability"]
  weight: number         // Weight during synthesis (0-1)
}
```

**Built-in views**:

| View              | Focus Areas                                      | System Prompt Theme               |
| ----------------- | ------------------------------------------------ | --------------------------------- |
| Architect         | scalability, maintainability, extensibility      | System design perspective         |
| Security Engineer | vulnerabilities, attack surface, data protection | Security-first perspective        |
| DevOps            | operability, monitoring, deployment              | Operational perspective           |
| Pragmatist        | simplicity, time-to-market, cost                 | Practical constraints perspective |

**Synthesizer**:

```typescript
interface SynthesisResult {
  consensus: Claim[]      // Claims agreed upon by multiple views
  conflicts: Controversy[] // Claims where views disagree
  synthesized: ReasoningState  // Merged state
}
```

Synthesis algorithm:

1. Collect all Views' States
2. Find claims present in >1 view → consensus (higher confidence)
3. Find contradictory claims across views → conflicts (Controversy)
4. Weight claims by view weight and confidence
5. Generate synthesized State

**Trigger conditions**:

* `multiView.enabled: true` in config

* Complexity > 0.7 → auto-enable (even if config disabled)

* User can specify custom views per request

**Implementation**:

* New `src/core/views.ts`: View definitions + built-in views

* New `src/core/synthesizer.ts`: Multi-view synthesis algorithm

* Modify `src/engine/loop.ts`: Support parallel multi-view reasoning (Promise.all for views)

* Modify `src/core/compiler.ts`: View-specific prompt compilation

***

## Layer 3 — Ecosystem Expansion

Builds on Layer 2's enhanced reasoning to expand ReasonLoop's reach.

### 3.1 Claude Code + Cursor Integration Verification

**Goal**: Zero-modification integration with top Agents.

**Claude Code integration**:

Setup: `ANTHROPIC_BASE_URL=http://localhost:8080/v1`

Verification checklist:

* [ ] Request format: messages, model, max\_tokens, system, tools

* [ ] Response format: content blocks (text, tool\_use), usage, stop\_reason

* [ ] Streaming: message\_start, content\_block\_start, content\_block\_delta, content\_block\_stop, message\_delta, message\_stop

* [ ] Error format: error.type, error.message

* [ ] Tool use passthrough: ReasonLoop does NOT intercept tool\_use blocks

* [ ] Multi-turn: conversation history preserved across requests

* [ ] Image/vision content passthrough

**Cursor integration**:

Setup: `OPENAI_BASE_URL=http://localhost:8080/v1`

Verification checklist:

* [ ] Request format: messages, model, temperature, tools, functions

* [ ] Response format: choices, usage, finish\_reason

* [ ] Streaming: SSE data chunks + `data: [DONE]`

* [ ] Function calling passthrough

* [ ] Multi-turn conversations

* [ ] Code context passthrough (Cursor-specific fields)

**Integration test suite**:

```
tests/integration/agent-compat/
  ├─ claude-code.test.ts
  │   ├─ basic request/response
  │   ├─ streaming
  │   ├─ tool_use passthrough
  │   ├─ multi-turn
  │   └─ error handling
  └─ cursor.test.ts
      ├─ basic request/response
      ├─ streaming
      ├─ function calling passthrough
      ├─ multi-turn
      └─ error handling
```

**Implementation**:

* New `tests/integration/agent-compat/`: Integration test suite

* Modify `routes/anthropic.ts`: Complete Anthropic streaming format

* Modify `routes/openai.ts`: Complete OpenAI streaming format

* New `docs/agent-integration.md`: Per-Agent setup guides

### 3.2 Long-Term Memory (Vector Database + Semantic Retrieval)

**Architecture**:

```
ReasoningState (session end)
  ↓
Memory Indexer
  ├─ Extract key claims, lessons, tags
  ├─ Generate embeddings via LLM provider
  └─ Store in Vector DB
  ↓
Vector Store (sqlite-vec)
  ↓
Memory Retriever (new request)
  ├─ Embed goal query
  ├─ Semantic search top-K
  └─ Return relevant memories
  ↓
Prompt Compiler (inject as [Historical Context])
```

**Memory entry**:

```typescript
interface MemoryEntry {
  id: string
  sessionId: string
  goal: string
  claims: string[]        // Key conclusions from reasoning
  lessons: string[]       // Lessons learned
  embedding: number[]     // Vector embedding
  timestamp: number
  tags: string[]          // Auto-extracted tags
}
```

**Storage**: SQLite + `sqlite-vec` extension (zero external dependencies, local-first)

**Embedding**: Use configured LLM provider's embedding API (OpenAI `text-embedding-3-small` / Anthropic `voyage-3`)

**Retrieval**:

* On new request, embed goal → semantic search → top-K (default 5)

* Inject into Prompt Compiler context as `[Historical Context]`

* Mark clearly to distinguish from current reasoning

**Implementation**:

* New `src/memory/indexer.ts`: Extract + embed + store

* New `src/memory/retriever.ts`: Semantic search

* New `src/memory/store.ts`: Vector store interface

* New `src/memory/store-sqlite-vec.ts`: sqlite-vec implementation

* Modify `src/core/compiler.ts`: Inject historical context

* Modify `src/engine/loop.ts`: Trigger memory indexing on session end

### 3.3 Knowledge Graph

**Scope**: Data model + storage + basic queries only. No visualization in this phase.

**Core model**:

```typescript
interface KnowledgeNode {
  id: string
  type: 'concept' | 'entity' | 'pattern' | 'anti-pattern'
  label: string
  properties: Record<string, unknown>
}

interface KnowledgeEdge {
  id: string
  source: string   // node id
  target: string   // node id
  type: 'depends-on' | 'contradicts' | 'supports' | 'related-to' | 'is-a'
  weight: number
  evidence: string // claim id that established this edge
}
```

**Extraction from reasoning**:

* Claims → KnowledgeNodes (concepts, entities)

* Claim relationships → KnowledgeEdges (depends-on, contradicts, supports)

* Graph grows with each reasoning session

**Queries**:

* Given a goal, retrieve relevant knowledge subgraph

* Discover implicit dependencies and contradictions

* Inject into Prompt Compiler context

**Storage**: SQLite with node/edge tables + adjacency index

**Implementation**:

* New `src/knowledge/types.ts`: Graph data model

* New `src/knowledge/store.ts`: SQLite graph storage

* New `src/knowledge/extractor.ts`: Extract knowledge from State

* New `src/knowledge/query.ts`: Graph queries (subgraph, neighbors, paths)

### 3.4 Complete README

**Structure**:

1. **What is ReasonLoop** — One-line definition + architecture diagram (Agent → ReasonLoop → LLM)
2. **Quick Start** — 3-step setup: install → configure → run
3. **Architecture** — System architecture deep-dive with pipeline diagram
4. **Configuration** — Complete config reference with all options and defaults
5. **Agent Integration** — Claude Code / Cursor / other Agent setup guides
6. **API Reference** — OpenAI / Anthropic compatible endpoints
7. **Reasoning Loop** — How the loop works: Planner → Critic → Adversary → Validator → Policy
8. **Validator** — Three validation modes: Code execution, Web retrieval, Rule engine
9. **Multi-View** — Multi-perspective reasoning and synthesis
10. **Memory & Knowledge** — Long-term memory and knowledge graph
11. **Observability** — Logging, Metrics, Tracing setup
12. **Contributing** — Development setup and contribution guidelines

***

## Implementation Order Summary

| Layer | Task                            | Dependencies | Estimated Files      |
| ----- | ------------------------------- | ------------ | -------------------- |
| L1    | 1.1 Streaming Passthrough       | None         | 3 new, 2 modified    |
| L1    | 1.2 Auth + Rate Limit           | None         | 1 new, 1 modified    |
| L1    | 1.3 Observability               | None         | 4 new, many modified |
| L1    | 1.4 Config Management           | None         | 2 new, many modified |
| L1    | 1.5 Timeout + Retry             | 1.4 (config) | 1 new, 2 modified    |
| L1    | 1.6 Session Persistence         | 1.4 (config) | 1 new, 3 modified    |
| L2    | 2.1 Validator                   | L1 complete  | 5 new, 1 modified    |
| L2    | 2.2 Policy Meta-Reasoning       | L1 complete  | 1 new, 1 modified    |
| L2    | 2.3 Scratchpad/Planner Refactor | L1 complete  | 3 modified           |
| L2    | 2.4 Multi-View                  | L1 complete  | 2 new, 2 modified    |
| L3    | 3.1 Agent Integration           | L2 complete  | 3 new, 2 modified    |
| L3    | 3.2 Long-Term Memory            | L2 complete  | 4 new, 2 modified    |
| L3    | 3.3 Knowledge Graph             | L2 complete  | 4 new                |
| L3    | 3.4 README                      | L3 complete  | 1 new                |

**Total**: \~25 new files, \~15 modified files, \~40 files touched

***

## Key Design Decisions

1. **Streaming**: Transparent passthrough first. Incremental streaming (showing reasoning progress) deferred to future work.
2. **Auth**: Opt-in via config. Empty apiKeys = no auth. Local dev friendly.
3. **Validator**: Composite strategy. Docker sandbox preferred, safe-eval fallback. Web search for factual claims.
4. **Policy**: Dual-mode. Heuristic for fast path, LLM meta-reasoning for complex cases.
5. **Multi-View**: Auto-triggered by high complexity. Built-in views + custom views.
6. **Memory**: SQLite-vec for zero-dependency local-first. Embedding via configured LLM provider.
7. **Knowledge Graph**: Data model + storage + queries only. Visualization deferred.
8. **Config**: Layered override (CLI > env > file > defaults). Zod validation.
9. **Storage**: SQLite as default. JSON still available for simple setups.
10. **Observability**: Full stack (logs + metrics + traces) but each layer independently configurable.

