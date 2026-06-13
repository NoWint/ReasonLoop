# ReasonLoop Kernel v3 — Design Specification

## Overview

ReasonLoop Kernel is a state-machine-based LLM reasoning runtime that transforms LLMs into iterative, stateful, and externally grounded problem-solving systems. Through looped reasoning, structured state management, adversarial evaluation, and external tool validation, it achieves stable solutions for complex tasks.

**Architecture**: Layered pipeline (Core / Engine / CLI)
**Tech Stack**: Node.js / TypeScript, Commander.js, OpenAI + Claude API, JSON state storage
**Product Form**: CLI tool (primary) + Node.js runtime library

---

## 1. Project Structure

```
reasonloop/
├── src/
│   ├── core/                    # Pure logic layer, no I/O
│   │   ├── state.ts             # State data structure & operations
│   │   ├── scratchpad.ts        # Scratchpad generation & extraction
│   │   ├── critic.ts            # Critic logic checking
│   │   ├── adversary.ts         # Adversary attack system
│   │   ├── policy.ts            # Policy controller
│   │   ├── transition.ts        # State Transition Engine
│   │   ├── convergence.ts       # Convergence detection
│   │   ├── multi-view.ts        # Multi-view reasoning
│   │   └── types.ts             # Core type definitions
│   ├── engine/                  # Orchestration layer, manages I/O & loop
│   │   ├── loop.ts              # Reasoning loop controller
│   │   ├── provider.ts          # LLM Provider abstraction
│   │   ├── providers/
│   │   │   ├── openai.ts        # OpenAI implementation
│   │   │   └── claude.ts        # Claude implementation
│   │   ├── tools/               # Tool Grounding
│   │   │   ├── sandbox.ts       # Code execution sandbox
│   │   │   ├── http.ts          # HTTP API calls
│   │   │   ├── filesystem.ts    # File system access
│   │   │   └── registry.ts      # Tool registry
│   │   └── storage.ts           # JSON state persistence
│   ├── cli/                     # CLI layer
│   │   ├── commands/
│   │   │   ├── run.ts           # reasonloop run
│   │   │   └── repl.ts          # reasonloop repl
│   │   ├── output.ts            # Output formatting (terminal/JSON)
│   │   └── index.ts             # CLI entry
│   └── index.ts                 # Library entry, exports Core + Engine
├── package.json
├── tsconfig.json
└── bin/
    └── reasonloop.ts            # CLI bin entry
```

**Key decisions:**
- `core/` has zero external I/O dependencies (no API calls, no filesystem), testable in isolation
- `engine/` is the sole layer that calls LLM APIs and executes tools
- `cli/` only handles argument parsing and output formatting, thin wrapper
- `src/index.ts` exports Core and Engine APIs for library usage

---

## 2. Core Data Structures

```typescript
// === State (Structured Memory Layer) ===
interface Claim {
  id: string;
  content: string;
  confidence: number;       // 0-1
  source: 'scratchpad' | 'critic' | 'adversary' | 'tool' | 'view';
  evidence: string[];       // linked evidence IDs
  iteration: number;        // first appearance iteration
}

interface Assumption {
  id: string;
  content: string;
  status: 'unverified' | 'supported' | 'challenged' | 'refuted';
  challengedBy: string[];   // adversary/critic issue IDs
  iteration: number;
}

interface Evidence {
  id: string;
  content: string;
  type: 'logical' | 'empirical' | 'tool_result' | 'retrieved';
  source: string;           // tool name / reasoning origin
  reliable: boolean;
  iteration: number;
}

interface Controversy {
  id: string;
  description: string;
  positions: string[];      // claim IDs for different positions
  resolved: boolean;
  resolution?: string;
}

interface State {
  iteration: number;
  claims: Claim[];
  assumptions: Assumption[];
  evidence: Evidence[];
  openQuestions: string[];
  controversies: Controversy[];
  metadata: {
    stability: number;      // 0-1, higher = more stable
    lastAction: string;
    budgetRemaining: number;
    totalTokensUsed: number;
  };
}

// === Critic Output ===
interface CriticOutput {
  issues: string[];
  risks: string[];
  contradictions: string[];
  suggestions: string[];    // correction suggestions
}

// === Policy Decision ===
type PolicyAction = 'expand' | 'refine' | 'verify' | 'adversary' | 'stop';

interface PolicyDecision {
  nextAction: PolicyAction;
  activeViews: string[];
  toolEnabled: boolean;
  reasoning: string;        // decision rationale
}

// === Multi-View ===
interface ViewResult {
  viewName: string;         // 'causal' | 'structural' | 'constraint' | 'comparative'
  state: State;             // independent state per view
  confidence: number;
}

// === Tool Result ===
interface ToolResult {
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
}
```

**Key design points:**
- Every Claim/Assumption/Evidence has `id` and `iteration` for cross-iteration tracking
- State `metadata` contains all information needed for convergence control
- CriticOutput includes `suggestions` for correction direction, not just problem identification
- ViewResult maintains independent State per view, merged during fusion

---

## 3. Reasoning Loop & Orchestration

```typescript
async function runLoop(input: string, config: RunConfig): Promise<RunResult> {
  let state = initState(input);
  const history: State[] = [state];

  while (true) {
    // 1. Policy decision (FIRST — determines this round's behavior)
    const decision = policy(state, config);
    if (decision.nextAction === 'stop') break;

    // 2. Multi-View reasoning (if active)
    const viewResults: ViewResult[] = [];
    if (decision.activeViews.length > 0) {
      for (const viewName of decision.activeViews) {
        const viewState = await runViewReasoning(viewName, state, provider);
        viewResults.push(viewState);
      }
    }

    // 3. Scratchpad generation
    const scratchpad = await generateScratchpad(state, decision, provider);

    // 4. Structured extraction
    const stateFragment = extractFromScratchpad(scratchpad, provider);

    // 5. Critic evaluation
    const criticOutput = await runCritic(stateFragment, state, provider);

    // 6. Adversary attack (if Policy decides)
    let adversaryOutput: CriticOutput | null = null;
    if (decision.nextAction === 'adversary') {
      adversaryOutput = await runAdversary(stateFragment, state, provider);
    }

    // 7. Tool execution (if enabled)
    let toolResults: ToolResult[] = [];
    if (decision.toolEnabled) {
      toolResults = await executeTools(state, config.tools);
    }

    // 8. State Transition
    state = transition(state, {
      scratchpad,
      stateFragment,
      critic: criticOutput,
      adversary: adversaryOutput,
      toolResults,
      viewResults,
    });

    // 9. Persistence
    history.push(state);
    await saveState(state, config.outputDir);

    // 10. Convergence check
    if (checkConvergence(state, config)) break;
  }

  return { finalState: state, history };
}
```

**Key design points:**
- Policy executes FIRST each iteration, determining round behavior
- Multi-View runs before Scratchpad, view results serve as input context
- Adversary is not run every round — Policy decides when to trigger
- Tool execution controlled by Policy's `toolEnabled`
- State auto-persisted each iteration, supports checkpoint recovery
- Convergence check after Transition provides dual guarantee (Policy stop + Convergence check)

---

## 4. LLM Provider Abstraction

```typescript
interface LLMProvider {
  name: string;
  complete(prompt: string, options: LLMOptions): Promise<LLMResponse>;
  stream?(prompt: string, options: LLMOptions): AsyncIterable<string>;
}

interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface LLMResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// Factory function
function createProvider(type: 'openai' | 'claude', config: ProviderConfig): LLMProvider
```

**Design points:**
- Unified `complete` interface, OpenAI and Claude each implement adapters
- Optional `stream` for real-time terminal output
- Each call returns token usage for budget tracking
- Provider created via factory function, config from CLI args or environment variables
- Prompt templates decoupled from Provider — core layer defines prompt strategy, engine layer calls Provider

---

## 5. Tool Grounding Layer

```typescript
interface Tool {
  name: string;
  description: string;       // description for LLM
  parameters: JSONSchema;    // parameter schema
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool;
  list(): Tool[];
  execute(name: string, params: Record<string, unknown>): Promise<ToolResult>;
}
```

### Built-in Tools

| Tool | Implementation | Safety Measures |
|------|---------------|-----------------|
| `code_exec` | `isolated-vm` sandbox for JS execution | Timeout limit, memory limit, no filesystem access |
| `http_request` | `fetch` wrapper | Domain whitelist, timeout, response size limit |
| `file_read` | `fs.readFile` wrapper | Read-only, path sandboxed to working directory |

### Tool Invocation Flow

1. Policy decides `toolEnabled: true`
2. Engine generates tool call plan based on State's `openQuestions` and `assumptions(status=unverified)`
3. LLM generates structured tool call parameters (JSON format)
4. ToolRegistry executes and returns ToolResult
5. ToolResult enters State Transition, updates Evidence and Assumption status

---

## 6. Multi-View Reasoning

```typescript
type ViewType = 'causal' | 'structural' | 'constraint' | 'comparative';

interface ViewConfig {
  name: ViewType;
  systemPrompt: string;      // view-specific system prompt
  constraints: string[];     // view-specific constraints
}

// Fusion strategy
function fuseViews(viewResults: ViewResult[], currentState: State): State {
  // 1. Collect claims from all views
  // 2. Deduplicate: semantically similar claims merged, take highest confidence
  // 3. Conflict marking: contradictory claims across views marked as Controversy
  // 4. Weighting: update claim confidence weighted by each view's confidence
  // 5. Merge evidence, update openQuestions
}
```

### View Definitions

- **causal**: Focus on causal chains — "Why does A lead to B?"
- **structural**: Focus on system structure — "How do parts compose?"
- **constraint**: Focus on constraints — "Under what conditions does this fail?"
- **comparative**: Focus on comparative analysis — "How does this compare to alternatives?"

### Fusion Timing

Each iteration, all active views' reasoning results are fused before State Transition. The fused result serves as the final State Fragment for that round's Transition.

---

## 7. CLI & REPL

### CLI Commands

```bash
# Basic run
reasonloop run "problem statement"

# With config
reasonloop run "problem" --provider openai --model gpt-4 --max-iterations 10 --budget 50000

# Debug mode
reasonloop run "problem" --trace

# JSON output
reasonloop run "problem" --json

# Specify views
reasonloop run "problem" --views causal,constraint
```

### REPL Mode

```bash
reasonloop repl

# REPL commands
> load "problem statement"     # Set problem
> step                         # Execute one iteration
> run                          # Run to convergence
> state                        # View current State
> state diff                   # View diff from previous step
> critic                       # View latest Critic output
> policy                       # View Policy decision
> tools                        # View tool execution results
> views                        # View multi-view state
> set provider openai          # Switch Provider
> set views causal,structural  # Set active views
> budget                       # View remaining budget
> history                      # View iteration history
> export                       # Export full run results
> help                         # Help
> quit                         # Exit
```

### Output Formats

**Terminal mode (default):**
```
[Iter 1/10] expand | stability: 0.2 | budget: 45000/50000
  Claims: 3 | Assumptions: 2 | Open Questions: 4
  Critic: 2 issues, 1 contradiction
  ─────────────────────────────────────
  Key claim: "Microservices architecture is suitable for..."
  Confidence: 0.65
```

**JSON mode (`--json`):**
```json
{
  "iteration": 1,
  "action": "expand",
  "state": { "..." : "..." },
  "critic": { "..." : "..." },
  "policy": { "..." : "..." },
  "usage": { "tokens": 5000, "cost": 0.15 }
}
```

---

## 8. Convergence & Cost Control

### Convergence Conditions

```typescript
interface ConvergenceConfig {
  maxIterations: number;      // default 10
  budgetLimit: number;        // token limit, default 100000
  stabilityThreshold: number; // default 0.85
  minIterations: number;      // minimum iterations, default 2
}

function checkConvergence(state: State, config: ConvergenceConfig): boolean {
  if (state.iteration < config.minIterations) return false;
  if (state.iteration >= config.maxIterations) return true;
  if (state.metadata.budgetRemaining <= 0) return true;
  if (state.metadata.stability >= config.stabilityThreshold) return true;
  return false;
}
```

### Stability Calculation

```typescript
function computeStability(current: State, previous: State): number {
  const claimDelta = setDifference(current.claims, previous.claims).length;
  const claimTotal = Math.max(current.claims.length, 1);
  const confidenceShift = avgConfidenceDelta(current, previous);

  // Less change = higher stability
  return 1 - (claimDelta / claimTotal * 0.6 + confidenceShift * 0.4);
}
```

### Cost Control Strategies

1. **Dynamic View Selection**: Policy reduces active views as stability increases. Stability > 0.5 → gradually reduce views
2. **Early Stop**: Consecutive 2 rounds with stability > threshold → terminate early
3. **Budget-Aware**: Remaining budget < 20% → Policy favors `refine` over `expand`
4. **Token Budget**: Estimate token cost before each LLM call, skip non-essential steps if over budget

---

## 9. Error Handling

- **LLM API errors**: Retry 3 times (exponential backoff), log error to State.openQuestions if still failing, continue loop
- **Tool execution errors**: Return `ToolResult { success: false, error: ... }`, error recorded as Evidence
- **State corruption**: Restore from previous iteration's persisted JSON
- **REPL interruption**: Catch SIGINT, save current State, then exit

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Layered pipeline (Core/Engine/CLI) | Clean boundaries, library-friendly, testable |
| LLM Provider | Dual support (OpenAI + Claude) | Flexibility, provider abstraction |
| State Storage | JSON files | Simple, transparent, easy to debug and diff |
| CLI Framework | Commander.js | Mature, type-safe, rich ecosystem |
| Product Form | CLI + Library dual mode | CLI for direct use, library for integration |
| Output Format | Switchable (terminal/JSON) | Human-friendly default, programmatic option |
| Multi-View | Full implementation | Complete reasoning coverage |
| Tool Grounding | Full support (code + HTTP + file) | Maximum external validation capability |
| REPL | Full implementation | Interactive debugging and exploration |
