# ReasonLoop

ReasonLoop is a reasoning middleware that sits between agents and language models, transforming raw prompts into structured, stateful, adversarially-evaluated reasoning processes before execution.

```
  User
   |
   v
  Agent  (Claude Code, Cursor, Cline, Aider, ...)
   |
   v
+------------------+
|   ReasonLoop     |  <-- Reasoning Middleware
+------------------+
   |
   v
  LLM  (OpenAI, Anthropic, ...)
   |
   v
  Response
```

Traditional agents pipe prompts directly to LLMs. ReasonLoop intercepts the request, runs a structured reasoning loop with planning, criticism, adversarial challenge, and validation, then returns a converged, well-evaluated response.

---

## Quick Start

**1. Install**

```bash
npm install
```

**2. Configure**

Set at least one API key:

```bash
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
```

**3. Run**

```bash
npx reasonloop start
```

The gateway starts on `http://0.0.0.0:8080` by default.

---

## Architecture

```
Agent
  |
  v
Gateway
  |
  v
Complexity Analyzer
  |
  v
Policy Controller
  |
  v
Reasoning Loop
  +---> Planner
  +---> Critic
  +---> Adversary
  +---> Validator
  |
  v
State Transition Engine
  |
  v
Prompt Compiler
  |
  v
Model Adapter
  |
  v
LLM
```

The gateway receives requests in OpenAI or Anthropic format. The complexity analyzer decides whether to run the full reasoning loop or pass through directly. When the loop is triggered, the policy controller drives iterations through planner, critic, adversary, and validator stages until convergence. The prompt compiler translates structured state into model-readable context, and the model adapter dispatches to the configured LLM provider.

---

## Configuration

ReasonLoop loads configuration from environment variables, CLI flags, and defaults (in that order of precedence).

### Reference Table

| Option | Default | Env Variable | CLI Flag |
|---|---|---|---|
| `server.port` | `8080` | `REASONLOOP_PORT` | `--port` |
| `server.host` | `0.0.0.0` | `REASONLOOP_HOST` | -- |
| `auth.enabled` | `false` | -- | -- |
| `auth.apiKeys` | `[]` | `REASONLOOP_API_KEY` | -- |
| `rateLimit.maxRequests` | `100` | -- | -- |
| `rateLimit.windowMs` | `60000` | -- | -- |
| `complexity.threshold` | `0.5` | -- | `--complexity-threshold` |
| `convergence.maxIterations` | `10` | -- | `--max-iterations` |
| `convergence.budgetLimit` | `100000` | -- | `--budget` |
| `convergence.stabilityThreshold` | `0.85` | -- | -- |
| `convergence.minIterations` | `2` | -- | -- |
| `convergence.complexityThreshold` | `0.5` | -- | -- |
| `models.default` | `gpt-4` | `REASONLOOP_MODEL` | `--model` |
| `models.timeout` | `60000` | -- | -- |
| `models.providers.openai.apiKey` | `""` | `OPENAI_API_KEY` | -- |
| `models.providers.openai.baseUrl` | -- | -- | -- |
| `models.providers.anthropic.apiKey` | `""` | `ANTHROPIC_API_KEY` | -- |
| `models.providers.anthropic.baseUrl` | -- | -- | -- |
| `observability.logLevel` | `info` | `REASONLOOP_LOG_LEVEL` | `--log-level` |
| `observability.metrics` | `true` | -- | -- |
| `observability.tracing.enabled` | `false` | -- | -- |
| `observability.tracing.endpoint` | -- | -- | -- |
| `storage.type` | `sqlite` | `REASONLOOP_STORAGE_TYPE` | `--storage-type` |
| `storage.path` | `./data/reasonloop` | `REASONLOOP_STORAGE_PATH` | `--output-dir` |
| `multiView.enabled` | `false` | -- | -- |
| `multiView.views` | `[]` | -- | -- |
| `memory.enabled` | `false` | -- | -- |
| `memory.topK` | `5` | -- | -- |
| `loop.timeout` | `300000` | -- | -- |
| `loop.maxRetries` | `3` | -- | -- |
| `loop.retryBaseDelay` | `1000` | -- | -- |

---

## Agent Integration

ReasonLoop exposes an OpenAI-compatible proxy. Point your agent's base URL at the gateway -- no code changes required.

### Claude Code

```bash
export ANTHROPIC_BASE_URL=http://localhost:8080/v1
```

### Cursor

```bash
export OPENAI_BASE_URL=http://localhost:8080/v1
```

### Any OpenAI-compatible agent

Set the base URL to `http://localhost:8080/v1` and provide your API key as usual. ReasonLoop forwards the key to the upstream provider.

---

## API Reference

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint. Supports streaming (`stream: true`) and non-streaming modes.

### POST /v1/messages

Anthropic-compatible messages endpoint. Supports streaming and non-streaming modes.

### GET /v1/models

Returns available models.

### GET /v1/sessions

Lists active reasoning sessions with goal, iteration count, stability score, and claim count.

### GET /metrics

Prometheus-compatible metrics endpoint.

---

## Reasoning Loop

The core of ReasonLoop is the iterative reasoning loop. Each iteration follows this pipeline:

```
Scratchpad  -->  Planner  -->  Critic  -->  Adversary  -->  Validator  -->  Policy  -->  State Update
```

1. **Scratchpad** -- Free-form exploration space. No structure, no constraints. The model thinks openly about the problem.

2. **Planner** -- Extracts structured claims, assumptions, and evidence from the scratchpad output. Proposes new paths and solutions.

3. **Critic** -- Identifies logical gaps, contradictions, missing considerations, and risks in the current state.

4. **Adversary** -- Actively attacks the current reasoning. Challenges assumptions, proposes edge cases, and tries to break self-consensus. Triggered by the policy controller when stability is low or periodically after iteration 4.

5. **Validator** -- Connects reasoning to reality through code execution, web retrieval, or rule checks (see below).

6. **Policy** -- Decides the next action: `expand`, `refine`, `verify`, `attack`, or `stop`. Based on marginal gain vs. marginal cost analysis.

7. **State Update** -- Merges all outputs into the canonical `ReasoningState`.

### Convergence

The loop terminates when any of these conditions is met:

- **Max iterations reached** (default: 10)
- **Budget exhausted** (default: 100,000 tokens)
- **Stability exceeds threshold** (default: 0.85)
- **Marginal gain falls below marginal cost** (after minimum iterations)

---

## Validator

Validators are the bridge between internal reasoning and external reality. Three modes are available:

### Code Execution

- **DockerSandboxValidator** -- Executes code in an isolated Docker container (falls back to safe eval when Docker is unavailable).
- **SafeEvalValidator** -- Evaluates JavaScript expressions against state context in a sandboxed `Function` constructor. Confidence defaults to 0.6.

### Web Retrieval

- **RetrievalValidator** -- Queries an external search provider (SearXNG, SerpAPI, or custom) and checks if results support the claim above a relevance threshold (default: 0.5).

### Rule Engine

- **RegexRuleValidator** -- Tests claim content against a regular expression pattern. Confidence defaults to 0.7.
- **JsonSchemaRuleValidator** -- Parses claim content as JSON and checks for required fields. Confidence defaults to 0.8.

Validators can be composed using `CompositeValidator` to run multiple checks in sequence.

---

## Multi-View

Multi-perspective reasoning runs the same problem through different viewpoints and synthesizes the results.

### Built-in Views

| View | Focus | Weight |
|---|---|---|
| **Architect** | Design, modularity, extensibility, trade-offs | 1.0 |
| **Security Engineer** | Threat modeling, auth, data protection | 0.9 |
| **DevOps** | Deployment, scalability, monitoring, reliability | 0.8 |
| **Pragmatist** | Simplicity, time-to-market, avoiding over-engineering | 0.7 |

Enable multi-view in configuration:

```json
{
  "multiView": {
    "enabled": true,
    "views": []
  }
}
```

When `views` is empty, the four built-in views are used. Custom views can be added with `id`, `name`, `systemPrompt`, `focusAreas`, and `weight`.

The synthesizer merges outputs from all views into consensus claims, identified conflicts, and a unified reasoning state.

---

## Memory and Knowledge

### Long-term Memory

When enabled, ReasonLoop persists reasoning outcomes across sessions using SQLite-vec for vector storage and semantic retrieval.

```json
{
  "memory": {
    "enabled": true,
    "topK": 5
  }
}
```

Each memory entry stores the session goal, claims, lessons learned, embedding vector, timestamp, and tags. The retriever uses cosine similarity to find relevant past reasoning for new sessions.

### Knowledge Graph

The knowledge module extracts structured relationships from reasoning states:

- **Nodes**: concepts, entities, patterns, anti-patterns
- **Edges**: depends-on, contradicts, supports, related-to, is-a

The graph enables cross-session knowledge accumulation and contextual retrieval.

---

## Observability

### Structured Logging

Powered by [pino](https://getpino.io/). Configure log level via `REASONLOOP_LOG_LEVEL` or `--log-level`:

```
trace | debug | info | warn | error | fatal
```

### Prometheus Metrics

Exposed at `GET /metrics`. Enabled by default (`observability.metrics: true`). Uses [prom-client](https://github.com/siimon/prom-client) for standard Node.js metrics.

### OpenTelemetry Tracing

Distributed tracing via the OpenTelemetry SDK. Enable in configuration:

```json
{
  "observability": {
    "tracing": {
      "enabled": true,
      "endpoint": "http://localhost:4318/v1/traces"
    }
  }
}
```

Exports traces via OTLP HTTP to the configured endpoint.

---

## Contributing

### Development Setup

```bash
git clone <repo-url>
cd ReasonLoop
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test           # single run
npm run test:watch # watch mode
```

### Type Check

```bash
npm run lint
```

### Development

```bash
npm run dev        # watch mode for TypeScript compilation
```

---

License: MIT
