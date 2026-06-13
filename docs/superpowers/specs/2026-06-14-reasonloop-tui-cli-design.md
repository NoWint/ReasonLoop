# ReasonLoop TUI CLI Design

## Overview

A terminal UI tool for ReasonLoop that provides:
1. Interactive chat with real-time reasoning process visualization
2. One-click setup for LLM providers and API keys
3. One-click export to Claude Code / Cursor / Codex
4. Optional background proxy server mode

## Commands

### `reasonloop chat`
Interactive chat with TUI. Core command.

Options:
- `--serve` - Also start background proxy server on port 8080
- `--provider <provider>` - LLM provider (openai/claude/deepseek/custom)
- `--model <model>` - Model name
- `--base-url <url>` - API base URL
- `--multi-view` - Enable multi-view reasoning
- `--max-iterations <n>` - Max reasoning iterations
- `--budget <n>` - Token budget

### `reasonloop setup`
Interactive configuration wizard.

Options:
- `--export <tool>` - Export config to specific tool (claude-code/cursor/codex/all)

### `reasonloop start` (existing, unchanged)

## TUI Layout

```
+----------------------------------------------------------+
| ReasonLoop v0.1.0 | deepseek-chat | multi-view: ON       |
| Iteration 2/10 | stability: 0.65 | budget: 72,000       |
+----------------------------------------------------------+
|                                                          |
| [SCRATCHPAD] 2.3s                                       |
| microservices vs monolith, the key is not tech but org.. |
| modular monolith is an underrated middle ground...       |
|                                                          |
| [PLANNER] 3.1s                                          |
| CLAIM: "Modular monolith" is a key pattern between...    |
| CLAIM: Org structure mismatch makes microservices fail   |
| ASSUMPTION: Team can enforce module boundaries           |
| QUESTION: What tools help decoupling within monolith?    |
|                                                          |
| [CRITIC] 1.8s                                           |
| ISSUE: Missing quantitative analysis of team size        |
| RISK: "almost certainly fail" is too absolute            |
| SUGGESTION: Introduce quantitative team size thresholds  |
|                                                          |
| [ADVERSARY] 2.0s                                        |
| ATTACK: What if there is only one full-stack developer?  |
| ATTACK: What if budget only covers one server?           |
|                                                          |
| -- Iteration 1 complete | next: refine --               |
|                                                          |
| [SCRATCHPAD] 1.9s                                       |
| Continuing deeper, considering counter-intuitive paths.. |
| |                                                        |
|                                                          |
+----------------------------------------------------------+
| > Analyze microservices vs monolith trade-offs           |
|   /help /config /multi-view /serve /clear Ctrl+C        |
+----------------------------------------------------------+
```

### Multi-View Display

When multi-view is enabled, views run in parallel and display as they complete:

```
[VIEW: Architect] 3.2s
CLAIM: Modular monolith is the best starting strategy...
ASSUMPTION: Team can incrementally evolve...

[VIEW: Pragmatist] 3.5s
CLAIM: Don't over-engineer, ship first...
ASSUMPTION: MVP doesn't need distributed...

[VIEW: DevOps] 4.1s
CLAIM: K8s operational cost is underestimated...
ASSUMPTION: Team has SRE experience...

[VIEW: Security] 4.8s
CLAIM: Zero-trust must be considered from the start...
ASSUMPTION: System handles sensitive data...

[SYNTHESIS] 3 consensus | 1 conflict
CONSENSUS: Modular monolith is best starting strategy (3 views agree)
CONFLICT: Security vs Pragmatist: "zero-trust from start" vs "ship first"
```

### Color Scheme (no emoji)

| Role | Color | Prefix |
|------|-------|--------|
| Scratchpad | gray/dim | [SCRATCHPAD] |
| Planner | cyan | [PLANNER] |
| Critic | yellow | [CRITIC] |
| Adversary | red | [ADVERSARY] |
| View: Architect | blue | [VIEW: Architect] |
| View: Security | magenta | [VIEW: Security] |
| View: DevOps | green | [VIEW: DevOps] |
| View: Pragmatist | yellow | [VIEW: Pragmatist] |
| Synthesis | white bold | [SYNTHESIS] |
| System messages | gray | -- text -- |
| User input | white | > input |

## Streaming Architecture

### LoopCallbacks

Add callback interface to `runLoop()` for real-time event streaming:

```typescript
export interface LoopCallbacks {
  onScratchpadStart?: () => void;
  onScratchpadChunk?: (chunk: string) => void;
  onScratchpadComplete?: (content: string, duration: number) => void;
  onPlannerStart?: () => void;
  onPlannerChunk?: (chunk: string) => void;
  onPlannerComplete?: (content: string, duration: number) => void;
  onViewStart?: (view: ReasoningView) => void;
  onViewChunk?: (view: ReasoningView, chunk: string) => void;
  onViewComplete?: (view: ReasoningView, content: string, duration: number) => void;
  onSynthesisComplete?: (result: SynthesisResult) => void;
  onCriticStart?: () => void;
  onCriticComplete?: (output: CriticOutput, duration: number) => void;
  onAdversaryStart?: () => void;
  onAdversaryComplete?: (output: CriticOutput, duration: number) => void;
  onIterationComplete?: (state: ReasoningState, decision: PolicyDecision) => void;
}
```

### Adapter Streaming

Add `streamComplete()` method to ModelAdapter:

```typescript
export interface ModelAdapter {
  name: string;
  complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse>;
  streamComplete?(prompt: string, options: AdapterOptions): AsyncIterable<string>;
  forward(request: unknown, protocol: 'openai' | 'anthropic'): Promise<unknown>;
}
```

OpenAI adapter uses `stream: true` with `for await (const chunk of stream)`.

## Chat Commands

| Command | Description |
|---------|-------------|
| `/multi-view` | Toggle multi-view mode |
| `/serve` | Start background proxy server |
| `/config` | Show current configuration |
| `/model <name>` | Switch model |
| `/max-iter <n>` | Adjust max iterations |
| `/budget <n>` | Adjust token budget |
| `/clear` | Clear screen |
| `/help` | Show help |
| `/exit` | Exit |

## Setup Command

### Interactive Flow

1. Select provider: OpenAI / Anthropic / DeepSeek / Custom
2. Enter API key
3. Base URL (auto-filled for known providers)
4. Model name (auto-suggested for known providers)
5. Save to `~/.reasonloop/config.json`

### Provider Presets

| Provider | Base URL | Default Model |
|----------|----------|---------------|
| OpenAI | https://api.openai.com/v1 | gpt-4 |
| Anthropic | https://api.anthropic.com | claude-sonnet-4-20250514 |
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| Custom | (user input) | (user input) |

### Export Targets

| Tool | Config File | What Gets Set |
|------|-------------|---------------|
| Claude Code | `~/.claude/settings.json` | `apiBaseUrl: http://localhost:8080/v1` |
| Cursor | Project `.env` | `OPENAI_BASE_URL=http://localhost:8080/v1` |
| Codex | `~/.codex/config.json` | `baseURL: http://localhost:8080/v1` |

## File Structure

```
src/cli/
  commands/
    chat.ts              # chat command entry point
    setup.ts             # setup command entry point
    start.ts             # existing (unchanged)
  tui/
    app.tsx              # Ink root component
    header.tsx           # status bar (model, iteration, stability, budget)
    reasoning.tsx        # reasoning process display (scratchpad/planner/critic/adversary)
    input.tsx            # user input area
    views.tsx            # multi-view display
    synthesis.tsx        # synthesis result display
  setup/
    provider.ts          # provider configuration logic
    export.ts            # export to Claude Code/Cursor/Codex
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `ink` | React-based TUI framework |
| `react` | Required by Ink |
| `ink-text-input` | Text input component |
| `ink-spinner` | Loading spinner |

## Config File

`~/.reasonloop/config.json`:

```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat",
  "multiView": false,
  "maxIterations": 10,
  "budget": 100000,
  "exports": {
    "claudeCode": true,
    "cursor": false,
    "codex": false
  }
}
```

## Implementation Order

1. Add `streamComplete()` to OpenAI adapter
2. Add `LoopCallbacks` to `runLoop()`
3. Build `reasonloop setup` command
4. Build `reasonloop chat` TUI (Ink)
5. Add export functionality (Claude Code/Cursor/Codex)
6. Add `--serve` mode to chat command
