# ReasonLoop Kernel v3 — Design Specification (Updated)

> **Based on:** AGENTS.md — ReasonLoop as Reasoning Middleware between Agents and Models

## Overview

ReasonLoop is a **reasoning middleware** that sits between Agents and LLMs, transforming raw prompts into structured, stateful, adversarially-evaluated reasoning processes before execution. It is NOT an Agent, NOT a Chat CLI, NOT a prompt collection — it is a runtime layer that elevates reasoning from the Prompt layer to the Runtime layer.

**Architecture:** Middleware pipeline (Gateway → Complexity Analyzer → Policy → Reasoning Loop → Prompt Compiler → Model Adapter → LLM)
**Tech Stack:** Node.js / TypeScript, Fastify, OpenAI SDK, Anthropic SDK, JSON state storage
**Product Form:** OpenAI/Anthropic Compatible Proxy Server (primary) + CLI Control Panel (secondary)
**Access:** Agent changes `baseURL` to `localhost:8080` — zero code changes required

---

## 1. Project Structure

```
reasonloop/
├── src/
│   ├── gateway/                  # HTTP entry layer
│   │   ├── server.ts             # Fastify HTTP Server
│   │   ├── routes/
│   │   │   ├── openai.ts         # OpenAI /v1/chat/completions compatible route
│   │   │   └── anthropic.ts      # Anthropic /v1/messages compatible route
│   │   ├── middleware.ts         # Request preprocessing / logging / error handling
│   │   └── types.ts              # Gateway request/response types
│   ├── core/                     # Pure logic layer, no I/O
│   │   ├── types.ts              # Core type definitions
│   │   ├── state.ts              # State data structure & operations
│   │   ├── scratchpad.ts         # Scratchpad free reasoning
│   │   ├── planner.ts            # Planner expansion reasoning
│   │   ├── critic.ts             # Critic logic checking
│   │   ├── adversary.ts          # Adversary attack system
│   │   ├── validator.ts          # Validator interface definition (interface only)
│   │   ├── policy.ts             # Policy Controller
│   │   ├── transition.ts         # State Transition Engine
│   │   ├── convergence.ts        # Convergence detection
│   │   ├── complexity.ts         # Complexity Analyzer
│   │   └── compiler.ts           # Prompt Compiler
│   ├── engine/                   # Reasoning engine orchestration
│   │   ├── loop.ts               # Reasoning loop controller
│   │   ├── adapter.ts            # Model Adapter interface & factory
│   │   └── adapters/
│   │       ├── openai.ts         # OpenAI adapter
│   │       └── claude.ts         # Claude adapter
│   ├── cli/                      # CLI Control Panel
│   │   ├── index.ts              # CLI entry (Commander)
│   │   ├── commands/
│   │   │   ├── start.ts          # reasonloop start (launch Proxy)
│   │   │   ├── status.ts         # reasonloop status
│   │   │   ├── sessions.ts       # reasonloop sessions
│   │   │   └── inspect.ts        # reasonloop inspect <id>
│   │   └── output.ts             # Output formatting
│   └── index.ts                  # Library entry
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Key design decisions:**
- `gateway/` is the primary entry point — Agent talks to ReasonLoop via HTTP
- `core/` has zero I/O dependencies, testable in isolation
- `engine/` orchestrates the reasoning loop and LLM calls
- `cli/` is a control panel for monitoring/debugging, not the main interface
- No `tools/` directory — tool execution is the Agent's responsibility

---

## 2. Core Data Structures

```typescript
// === ReasoningState (Single Source of Truth) ===
interface ReasoningState {
  id: string;                     // Session ID
  goal: string;                   // Original goal
  iteration: number;
  claims: Claim[];
  assumptions: Assumption[];
  evidence: Evidence[];
  openQuestions: string[];
  controversies: Controversy[];
  metadata: {
    stability: number;
    complexity: number;           // Complexity score
    lastAction: string;
    budgetRemaining: number;
    totalTokensUsed: number;
    createdAt: number;
    updatedAt: number;
  };
}

interface Claim {
  id: string;
  content: string;
  confidence: number;             // 0-1
  source: 'planner' | 'critic' | 'adversary' | 'validator';
  evidence: string[];             // Linked evidence IDs
  iteration: number;
}

interface Assumption {
  id: string;
  content: string;
  status: 'unverified' | 'supported' | 'challenged' | 'refuted';
  challengedBy: string[];
  iteration: number;
}

interface Evidence {
  id: string;
  content: string;
  type: 'logical' | 'empirical' | 'validator_result' | 'retrieved';
  source: string;
  reliable: boolean;
  iteration: number;
}

interface Controversy {
  id: string;
  description: string;
  positions: string[];
  resolved: boolean;
  resolution?: string;
}

// === Complexity Analysis ===
interface ComplexityAnalysis {
  score: number;                  // 0-1
  shouldLoop: boolean;            // score >= threshold → true
  reasoning: string;
}

// === Prompt Compiler Output ===
interface CompiledPrompt {
  system: string;                 // Compiled system prompt
  user: string;                   // Compiled user prompt
  context: string;                // State summary context
}

// === Validator Interface (interface only, no implementation) ===
interface Validator {
  name: string;
  validate(state: ReasoningState): Promise<ValidationResult>;
}

interface ValidationResult {
  passed: boolean;
  evidence: string;
  details?: string;
}

// === Policy Decision ===
type Decision = 'expand' | 'refine' | 'verify' | 'attack' | 'stop';

interface PolicyDecision {
  nextAction: Decision;
  reasoning: string;
  estimatedGain: number;          // Estimated marginal gain
  estimatedCost: number;          // Estimated marginal cost
}

// === Critic Output ===
interface CriticOutput {
  issues: string[];
  risks: string[];
  contradictions: string[];
  suggestions: string[];
}

// === Gateway Types ===
interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ProxyResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// === Convergence Config ===
interface ConvergenceConfig {
  maxIterations: number;
  budgetLimit: number;
  stabilityThreshold: number;
  minIterations: number;
  complexityThreshold: number;    // Threshold for looping vs passthrough
}
```

---

## 3. Request Processing Flow

```
Agent sends request (OpenAI/Anthropic format)
  ↓
Gateway receives and parses
  ↓
Complexity Analyzer evaluates complexity
  ↓
  ├─ Low complexity → Direct passthrough to LLM (zero overhead)
  └─ High complexity → Start reasoning loop
       ↓
     Policy Controller decides first action
       ↓
     ┌→ Reasoning Loop ─────────────────────────┐
     │  1. Planner: Expand reasoning              │
     │  2. Critic: Logic checking                 │
     │  3. Adversary: Attack assumptions          │
     │     (Policy decides when to trigger)       │
     │  4. Validator: External validation          │
     │     (Interface only, no-op in MVP)         │
     │  5. State Transition: Update state          │
     │  6. Policy: Decide next action              │
     │  7. Convergence Check: Is it converged?     │
     └──────────── Not converged ─────────────────┘
                ↓ Converged
     Prompt Compiler: Compile final State into response
       ↓
  Model Adapter: Format as OpenAI/Anthropic response
       ↓
Gateway returns response to Agent
```

**Key points:**
- Low complexity requests have **zero overhead** — they passthrough directly
- After reasoning loop completes, final State is compiled into an Agent-understandable response
- Agent is completely unaware of ReasonLoop — it thinks it's talking directly to the LLM
- Reasoning loop has an overall timeout (default 60s) — returns best available State if exceeded

---

## 4. Complexity Analyzer

```typescript
function analyzeComplexity(request: ProxyRequest, threshold: number = 0.5): ComplexityAnalysis {
  const lastMessage = request.messages[request.messages.length - 1]?.content ?? '';
  const totalLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);

  let score = 0;

  // Length factor (0-0.3): longer conversations → higher complexity
  score += Math.min(totalLength / 5000, 1) * 0.3;

  // Keyword factor (0-0.4): design/architecture/analysis keywords
  const complexKeywords = [
    '设计', '架构', '分析', '比较', '评估', '方案', '实现',
    'design', 'architect', 'analyze', 'compare', 'evaluate', 'implement', 'solution',
  ];
  const hasComplexKeyword = complexKeywords.some(kw => lastMessage.toLowerCase().includes(kw));
  if (hasComplexKeyword) score += 0.4;

  // Question pattern factor (0-0.3)
  const isQuestion = /^(how|why|what|which|是否|如何|为什么|哪个)/i.test(lastMessage.trim());
  if (isQuestion) score += 0.15;
  const isDesignTask = /设计|实现|方案|design|implement|solution/i.test(lastMessage);
  if (isDesignTask) score += 0.15;

  score = Math.min(score, 1);

  return {
    score,
    shouldLoop: score >= threshold,
    reasoning: `Complexity ${score.toFixed(2)} ${score >= threshold ? '>=' : '<'} threshold ${threshold}`,
  };
}
```

---

## 5. Prompt Compiler

The Prompt Compiler is one of the most critical technical modules — it translates structured State into LLM-understandable text.

```typescript
function compileState(state: ReasoningState, action: Decision, role: 'planner' | 'critic' | 'adversary'): CompiledPrompt {
  // Role-specific system prompts
  const rolePrompts: Record<string, string> = {
    planner: 'You are a reasoning planner. Expand the analysis, propose solutions, and discover possible paths. Do NOT judge correctness — only explore.',
    critic: 'You are a critical reasoning evaluator. Find logical flaws, gaps, and inconsistencies. Use ISSUE/RISK/CONTRADICTION/SUGGESTION prefixes.',
    adversary: 'You are an adversary. Actively attack and undermine the reasoning. Construct counter-examples, break assumptions, find edge cases.',
  };

  const system = `${rolePrompts[role]}

Current task: ${action}
Iteration: ${state.iteration}
Stability: ${state.metadata.stability.toFixed(2)}

Output format:
- CLAIM: <factual assertion>
- ASSUMPTION: <unstated premise>
- EVIDENCE: <supporting data>
- QUESTION: <open question>`;

  // Compile State into user prompt context
  const sections: string[] = [];
  sections.push(`## Goal\n${state.goal}`);

  if (state.claims.length > 0) {
    sections.push('## Current Claims');
    state.claims.forEach(c =>
      sections.push(`- [${c.confidence.toFixed(2)}] ${c.content} (source: ${c.source})`)
    );
  }

  if (state.assumptions.length > 0) {
    sections.push('## Assumptions');
    state.assumptions.forEach(a =>
      sections.push(`- [${a.status}] ${a.content}`)
    );
  }

  if (state.evidence.length > 0) {
    sections.push('## Evidence');
    state.evidence.forEach(e =>
      sections.push(`- [${e.type}] ${e.content}`)
    );
  }

  if (state.openQuestions.length > 0) {
    sections.push('## Open Questions');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
  }

  if (state.controversies.length > 0) {
    sections.push('## Controversies');
    state.controversies.forEach(c =>
      sections.push(`- ${c.description} ${c.resolved ? '(resolved)' : '(unresolved)'}`)
    );
  }

  const context = `Reasoning completed in ${state.iteration} iterations. ` +
    `Final stability: ${state.metadata.stability.toFixed(2)}. ` +
    `${state.claims.length} claims, ${state.openQuestions.length} open questions.`;

  return { system, user: sections.join('\n\n'), context };
}

function compileFinalResponse(state: ReasoningState, originalMessages: Array<{role: string; content: string}>): string {
  // Compile the final converged State into a natural language response
  // that directly answers the Agent's original question
  const sections: string[] = [];

  // Top claims sorted by confidence
  const topClaims = [...state.claims].sort((a, b) => b.confidence - a.confidence);
  if (topClaims.length > 0) {
    sections.push('### Key Findings');
    topClaims.forEach(c => sections.push(`- ${c.content} (confidence: ${c.confidence.toFixed(2)})`));
  }

  // Unresolved questions
  if (state.openQuestions.length > 0) {
    sections.push('### Remaining Questions');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
  }

  // Controversies
  if (state.controversies.some(c => !c.resolved)) {
    sections.push('### Open Controversies');
    state.controversies.filter(c => !c.resolved).forEach(c =>
      sections.push(`- ${c.description}`)
    );
  }

  return sections.join('\n\n');
}
```

---

## 6. Gateway (Proxy Server)

```typescript
// Core routes:
// POST /v1/chat/completions  (OpenAI compatible)
// POST /v1/messages          (Anthropic compatible)
// GET  /v1/models            (List available models)

async function handleRequest(
  req: ProxyRequest,
  protocol: 'openai' | 'anthropic',
  config: ServerConfig,
): Promise<ProxyResponse> {
  // 1. Complexity Analysis
  const analysis = analyzeComplexity(req, config.complexityThreshold);

  if (!analysis.shouldLoop) {
    // Passthrough mode: forward directly to LLM
    return await modelAdapter.forward(req, protocol);
  }

  // 2. Reasoning loop mode
  const goal = extractGoal(req.messages);
  const state = initState(goal, config.budget);
  const result = await runLoop(state, config, modelAdapter);

  // 3. Compile final State into response
  const compiled = compileFinalResponse(result.finalState, req.messages);

  // 4. Format as protocol-specific response
  return formatResponse(compiled, protocol, req.model, result.finalState.metadata.totalTokensUsed);
}
```

**Gateway features:**
- Dual protocol support: OpenAI `/v1/chat/completions` and Anthropic `/v1/messages`
- Low complexity requests: zero-overhead passthrough
- High complexity requests: full reasoning loop then return compiled response
- Session management: multiple requests from same conversation share State
- Streaming support: passthrough mode streams directly; reasoning mode returns final response
- Configurable via CLI and environment variables

---

## 7. CLI Control Panel

```bash
# Start Proxy Server
reasonloop start --port 8080 --provider openai --model gpt-4

# View server status
reasonloop status
# → Running on :8080 | Provider: openai | Active sessions: 3

# List all reasoning sessions
reasonloop sessions
# → [abc123] "Design Minecraft launcher" | 5 iterations | stability: 0.87
# → [def456] "Compare REST vs GraphQL"   | 3 iterations | stability: 0.72

# Inspect a specific session's reasoning process
reasonloop inspect abc123
# → Iteration 1: expand | claims: 3 | assumptions: 2
# → Iteration 2: critic  | issues: 1 | contradictions: 0
# → Iteration 3: attack  | counter-examples: 2

# View State diff between iterations
reasonloop inspect abc123 --diff 2-3

# Configuration
reasonloop config set complexity.threshold 0.6
reasonloop config set max.iterations 15
```

---

## 8. Convergence & Cost Control

### Convergence Conditions

```typescript
function checkConvergence(state: ReasoningState, config: ConvergenceConfig): boolean {
  if (state.iteration < config.minIterations) return false;
  if (state.iteration >= config.maxIterations) return true;
  if (state.metadata.budgetRemaining <= 0) return true;
  if (state.metadata.stability >= config.stabilityThreshold) return true;
  return false;
}
```

### Marginal Gain vs Marginal Cost

The Policy Controller uses a marginal analysis framework:

```typescript
function estimateGain(state: ReasoningState): number {
  // Based on: number of open questions, unresolved controversies, unverified assumptions
  const openScore = state.openQuestions.length * 0.2;
  const controversyScore = state.controversies.filter(c => !c.resolved).length * 0.15;
  const unverifiedScore = state.assumptions.filter(a => a.status === 'unverified').length * 0.1;
  return Math.min(openScore + controversyScore + unverifiedScore, 1);
}

function estimateCost(state: ReasoningState): number {
  // Based on: tokens already used, budget remaining ratio
  const budgetUsedRatio = 1 - (state.metadata.budgetRemaining / 100000);
  const iterationCost = 0.1; // estimated cost per iteration
  return budgetUsedRatio * 0.5 + iterationCost;
}
```

If `estimatedGain < estimatedCost` after min iterations, the loop stops.

---

## 9. Error Handling

- **LLM API errors**: Retry 3 times (exponential backoff), return error to Agent if still failing
- **Gateway timeout**: Reasoning loop has overall timeout (default 60s), returns best available State if exceeded
- **Session state loss**: State persisted to JSON each iteration, recoverable after restart
- **Agent disconnect**: Gateway detects disconnect, stops reasoning loop
- **Passthrough failure**: If passthrough to LLM fails, return standard error response

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Positioning | Reasoning Middleware | Between Agent and LLM, not standalone CLI |
| Architecture | Middleware pipeline | Matches AGENTS.md architecture diagram |
| Access Method | OpenAI + Anthropic Compatible Proxy | Zero code changes for Agent integration |
| Tool Grounding | Not in scope | Tool execution is Agent's responsibility |
| Validator | Interface only in MVP | Define contract, implement later |
| Complexity Analyzer | Implemented | Critical for passthrough vs loop decision |
| Prompt Compiler | Implemented | Most critical technical module |
| CLI | Control panel | For monitoring/debugging, not main interface |
| State Storage | JSON files | Simple, transparent, easy to debug |
| HTTP Framework | Fastify | High performance, TypeScript-native, plugin system |
| Multi-View | Deferred | Not in MVP scope per AGENTS.md |
