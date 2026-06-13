# ReasonLoop Kernel v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a state-machine-based LLM reasoning runtime with iterative loop, critic/adversary evaluation, tool grounding, multi-view reasoning, and CLI/REPL interface.

**Architecture:** Layered pipeline — Core (pure logic, no I/O) → Engine (orchestration, LLM calls, tool execution) → CLI (Commander.js commands + REPL). Each layer depends only on the layer below.

**Tech Stack:** TypeScript, Node.js, Commander.js, OpenAI SDK, Anthropic SDK, isolated-vm, chalk

---

## File Structure

```
reasonloop/
├── src/
│   ├── core/
│   │   ├── types.ts             # All core type definitions
│   │   ├── state.ts             # State creation, mutation, diff
│   │   ├── scratchpad.ts        # Scratchpad generation prompt & extraction
│   │   ├── critic.ts            # Critic evaluation logic
│   │   ├── adversary.ts         # Adversary attack logic
│   │   ├── policy.ts            # Policy controller
│   │   ├── transition.ts        # State transition engine
│   │   ├── convergence.ts       # Convergence detection
│   │   └── multi-view.ts        # Multi-view reasoning & fusion
│   ├── engine/
│   │   ├── loop.ts              # Main reasoning loop
│   │   ├── provider.ts          # LLM Provider interface & factory
│   │   ├── providers/
│   │   │   ├── openai.ts        # OpenAI provider
│   │   │   └── claude.ts        # Claude provider
│   │   ├── tools/
│   │   │   ├── registry.ts      # Tool registry
│   │   │   ├── sandbox.ts       # Code execution sandbox
│   │   │   ├── http.ts          # HTTP request tool
│   │   │   └── filesystem.ts    # File read tool
│   │   └── storage.ts           # JSON state persistence
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── run.ts           # reasonloop run command
│   │   │   └── repl.ts          # reasonloop repl command
│   │   ├── output.ts            # Terminal/JSON output formatting
│   │   └── index.ts             # CLI entry (Commander program)
│   └── index.ts                 # Library entry (exports Core + Engine)
├── tests/
│   ├── core/
│   │   ├── state.test.ts
│   │   ├── scratchpad.test.ts
│   │   ├── critic.test.ts
│   │   ├── adversary.test.ts
│   │   ├── policy.test.ts
│   │   ├── transition.test.ts
│   │   ├── convergence.test.ts
│   │   └── multi-view.test.ts
│   ├── engine/
│   │   ├── loop.test.ts
│   │   ├── provider.test.ts
│   │   ├── tools/
│   │   │   ├── registry.test.ts
│   │   │   ├── sandbox.test.ts
│   │   │   ├── http.test.ts
│   │   │   └── filesystem.test.ts
│   │   └── storage.test.ts
│   └── cli/
│       ├── run.test.ts
│       └── repl.test.ts
├── bin/
│   └── reasonloop.ts            # CLI bin entry
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `bin/reasonloop.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/xiatian/Desktop/ReasonLoop
npm init -y
```

Then edit `package.json` to:

```json
{
  "name": "reasonloop",
  "version": "0.1.0",
  "description": "A controlled reasoning runtime that transforms LLMs into iterative, stateful, and externally grounded problem-solving systems",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "reasonloop": "dist/bin/reasonloop.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "start": "node dist/bin/reasonloop.js"
  },
  "keywords": ["llm", "reasoning", "runtime", "state-machine"],
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install commander openai @anthropic-ai/sdk isolated-vm chalk
npm install -D typescript vitest @types/node tsx
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create bin/reasonloop.ts**

```typescript
#!/usr/bin/env node
import { runCLI } from '../src/cli/index.js';

runCLI();
```

- [ ] **Step 6: Create src/index.ts (empty placeholder)**

```typescript
// ReasonLoop Kernel - Library Entry
// Will be populated as modules are implemented
export {};
```

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p src/core src/engine/providers src/engine/tools src/cli/commands tests/core tests/engine/tools tests/cli
```

- [ ] **Step 8: Verify build works**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with TypeScript, Vitest, Commander"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`
- Create: `tests/core/types.test.ts`

- [ ] **Step 1: Write the test for type exports**

```typescript
// tests/core/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Claim,
  Assumption,
  Evidence,
  Controversy,
  State,
  CriticOutput,
  PolicyAction,
  PolicyDecision,
  ViewResult,
  ViewType,
  ToolResult,
  ConvergenceConfig,
  RunConfig,
  RunResult,
} from '../../src/core/types.js';

describe('Core Types', () => {
  it('should export Claim type', () => {
    const claim: Claim = {
      id: 'c1',
      content: 'Test claim',
      confidence: 0.8,
      source: 'scratchpad',
      evidence: ['e1'],
      iteration: 1,
    };
    expect(claim.id).toBe('c1');
  });

  it('should export Assumption type', () => {
    const assumption: Assumption = {
      id: 'a1',
      content: 'Test assumption',
      status: 'unverified',
      challengedBy: [],
      iteration: 1,
    };
    expect(assumption.status).toBe('unverified');
  });

  it('should export Evidence type', () => {
    const evidence: Evidence = {
      id: 'e1',
      content: 'Test evidence',
      type: 'logical',
      source: 'reasoning',
      reliable: true,
      iteration: 1,
    };
    expect(evidence.type).toBe('logical');
  });

  it('should export Controversy type', () => {
    const controversy: Controversy = {
      id: 'cv1',
      description: 'Test controversy',
      positions: ['c1', 'c2'],
      resolved: false,
    };
    expect(controversy.resolved).toBe(false);
  });

  it('should export State type', () => {
    const state: State = {
      iteration: 0,
      claims: [],
      assumptions: [],
      evidence: [],
      openQuestions: ['What is the problem?'],
      controversies: [],
      metadata: {
        stability: 0,
        lastAction: 'init',
        budgetRemaining: 100000,
        totalTokensUsed: 0,
      },
    };
    expect(state.iteration).toBe(0);
    expect(state.openQuestions).toHaveLength(1);
  });

  it('should export CriticOutput type', () => {
    const output: CriticOutput = {
      issues: ['Missing evidence'],
      risks: ['Assumption unverified'],
      contradictions: [],
      suggestions: ['Add supporting evidence'],
    };
    expect(output.issues).toHaveLength(1);
  });

  it('should export PolicyDecision type', () => {
    const decision: PolicyDecision = {
      nextAction: 'expand',
      activeViews: ['causal'],
      toolEnabled: false,
      reasoning: 'Initial exploration needed',
    };
    expect(decision.nextAction).toBe('expand');
  });

  it('should export ViewResult type', () => {
    const viewResult: ViewResult = {
      viewName: 'causal',
      state: {
        iteration: 1,
        claims: [],
        assumptions: [],
        evidence: [],
        openQuestions: [],
        controversies: [],
        metadata: { stability: 0, lastAction: 'expand', budgetRemaining: 90000, totalTokensUsed: 10000 },
      },
      confidence: 0.7,
    };
    expect(viewResult.viewName).toBe('causal');
  });

  it('should export ToolResult type', () => {
    const result: ToolResult = {
      toolName: 'code_exec',
      success: true,
      output: '42',
    };
    expect(result.success).toBe(true);
  });

  it('should export ConvergenceConfig type', () => {
    const config: ConvergenceConfig = {
      maxIterations: 10,
      budgetLimit: 100000,
      stabilityThreshold: 0.85,
      minIterations: 2,
    };
    expect(config.maxIterations).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/types.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write src/core/types.ts**

```typescript
// Core type definitions for ReasonLoop Kernel

export interface Claim {
  id: string;
  content: string;
  confidence: number;
  source: 'scratchpad' | 'critic' | 'adversary' | 'tool' | 'view';
  evidence: string[];
  iteration: number;
}

export interface Assumption {
  id: string;
  content: string;
  status: 'unverified' | 'supported' | 'challenged' | 'refuted';
  challengedBy: string[];
  iteration: number;
}

export interface Evidence {
  id: string;
  content: string;
  type: 'logical' | 'empirical' | 'tool_result' | 'retrieved';
  source: string;
  reliable: boolean;
  iteration: number;
}

export interface Controversy {
  id: string;
  description: string;
  positions: string[];
  resolved: boolean;
  resolution?: string;
}

export interface StateMetadata {
  stability: number;
  lastAction: string;
  budgetRemaining: number;
  totalTokensUsed: number;
}

export interface State {
  iteration: number;
  claims: Claim[];
  assumptions: Assumption[];
  evidence: Evidence[];
  openQuestions: string[];
  controversies: Controversy[];
  metadata: StateMetadata;
}

export interface CriticOutput {
  issues: string[];
  risks: string[];
  contradictions: string[];
  suggestions: string[];
}

export type PolicyAction = 'expand' | 'refine' | 'verify' | 'adversary' | 'stop';

export interface PolicyDecision {
  nextAction: PolicyAction;
  activeViews: string[];
  toolEnabled: boolean;
  reasoning: string;
}

export type ViewType = 'causal' | 'structural' | 'constraint' | 'comparative';

export interface ViewResult {
  viewName: string;
  state: State;
  confidence: number;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface ConvergenceConfig {
  maxIterations: number;
  budgetLimit: number;
  stabilityThreshold: number;
  minIterations: number;
}

export interface RunConfig {
  provider: 'openai' | 'claude';
  model: string;
  apiKey?: string;
  maxIterations: number;
  budget: number;
  stabilityThreshold: number;
  minIterations: number;
  activeViews: ViewType[];
  toolEnabled: boolean;
  outputDir: string;
  trace: boolean;
  json: boolean;
}

export interface RunResult {
  finalState: State;
  history: State[];
}

export interface TransitionInput {
  scratchpad: string;
  stateFragment: Partial<State>;
  critic: CriticOutput;
  adversary: CriticOutput | null;
  toolResults: ToolResult[];
  viewResults: ViewResult[];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts tests/core/types.test.ts
git commit -m "feat: add core type definitions"
```

---

### Task 3: State Module

**Files:**
- Create: `src/core/state.ts`
- Create: `tests/core/state.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/state.test.ts
import { describe, it, expect } from 'vitest';
import { initState, computeStability, diffStates, addClaim, addAssumption, addEvidence } from '../../src/core/state.js';
import type { Claim, Assumption, Evidence, State } from '../../src/core/types.js';

describe('State Module', () => {
  describe('initState', () => {
    it('should create initial state from problem input', () => {
      const state = initState('Design a microservices system');
      expect(state.iteration).toBe(0);
      expect(state.claims).toHaveLength(0);
      expect(state.assumptions).toHaveLength(0);
      expect(state.evidence).toHaveLength(0);
      expect(state.openQuestions).toEqual(['Design a microservices system']);
      expect(state.controversies).toHaveLength(0);
      expect(state.metadata.stability).toBe(0);
      expect(state.metadata.lastAction).toBe('init');
      expect(state.metadata.budgetRemaining).toBeGreaterThan(0);
      expect(state.metadata.totalTokensUsed).toBe(0);
    });
  });

  describe('addClaim', () => {
    it('should add a claim to state with generated id', () => {
      const state = initState('test');
      const claim: Omit<Claim, 'id'> = {
        content: 'Test claim',
        confidence: 0.8,
        source: 'scratchpad',
        evidence: [],
        iteration: 1,
      };
      const newState = addClaim(state, claim);
      expect(newState.claims).toHaveLength(1);
      expect(newState.claims[0].id).toMatch(/^claim-/);
      expect(newState.claims[0].content).toBe('Test claim');
    });

    it('should not mutate original state', () => {
      const state = initState('test');
      const claim: Omit<Claim, 'id'> = {
        content: 'Test claim',
        confidence: 0.8,
        source: 'scratchpad',
        evidence: [],
        iteration: 1,
      };
      addClaim(state, claim);
      expect(state.claims).toHaveLength(0);
    });
  });

  describe('addAssumption', () => {
    it('should add an assumption to state', () => {
      const state = initState('test');
      const assumption: Omit<Assumption, 'id'> = {
        content: 'Test assumption',
        status: 'unverified',
        challengedBy: [],
        iteration: 1,
      };
      const newState = addAssumption(state, assumption);
      expect(newState.assumptions).toHaveLength(1);
      expect(newState.assumptions[0].id).toMatch(/^assumption-/);
    });
  });

  describe('addEvidence', () => {
    it('should add evidence to state', () => {
      const state = initState('test');
      const evidence: Omit<Evidence, 'id'> = {
        content: 'Test evidence',
        type: 'logical',
        source: 'reasoning',
        reliable: true,
        iteration: 1,
      };
      const newState = addEvidence(state, evidence);
      expect(newState.evidence).toHaveLength(1);
      expect(newState.evidence[0].id).toMatch(/^evidence-/);
    });
  });

  describe('computeStability', () => {
    it('should return 1 when states are identical', () => {
      const state = initState('test');
      const stability = computeStability(state, state);
      expect(stability).toBe(1);
    });

    it('should return lower stability when claims change significantly', () => {
      const prev = initState('test');
      let curr = initState('test');
      curr = addClaim(curr, {
        content: 'New claim 1',
        confidence: 0.8,
        source: 'scratchpad',
        evidence: [],
        iteration: 1,
      });
      curr = addClaim(curr, {
        content: 'New claim 2',
        confidence: 0.7,
        source: 'scratchpad',
        evidence: [],
        iteration: 1,
      });
      const stability = computeStability(curr, prev);
      expect(stability).toBeLessThan(1);
      expect(stability).toBeGreaterThanOrEqual(0);
    });
  });

  describe('diffStates', () => {
    it('should report added claims', () => {
      const prev = initState('test');
      let curr = initState('test');
      curr = addClaim(curr, {
        content: 'New claim',
        confidence: 0.8,
        source: 'scratchpad',
        evidence: [],
        iteration: 1,
      });
      const diff = diffStates(curr, prev);
      expect(diff.claimsAdded).toBe(1);
      expect(diff.claimsRemoved).toBe(0);
    });

    it('should report removed claims', () => {
      let prev = initState('test');
      prev = addClaim(prev, {
        content: 'Old claim',
        confidence: 0.5,
        source: 'scratchpad',
        evidence: [],
        iteration: 0,
      });
      const curr = initState('test');
      const diff = diffStates(curr, prev);
      expect(diff.claimsAdded).toBe(0);
      expect(diff.claimsRemoved).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/state.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write src/core/state.ts**

```typescript
import type { Claim, Assumption, Evidence, State } from './types.js';

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function initState(problem: string, budget: number = 100000): State {
  return {
    iteration: 0,
    claims: [],
    assumptions: [],
    evidence: [],
    openQuestions: [problem],
    controversies: [],
    metadata: {
      stability: 0,
      lastAction: 'init',
      budgetRemaining: budget,
      totalTokensUsed: 0,
    },
  };
}

export function addClaim(state: State, claim: Omit<Claim, 'id'>): State {
  const newClaim: Claim = { ...claim, id: generateId('claim') };
  return {
    ...state,
    claims: [...state.claims, newClaim],
  };
}

export function addAssumption(state: State, assumption: Omit<Assumption, 'id'>): State {
  const newAssumption: Assumption = { ...assumption, id: generateId('assumption') };
  return {
    ...state,
    assumptions: [...state.assumptions, newAssumption],
  };
}

export function addEvidence(state: State, evidence: Omit<Evidence, 'id'>): State {
  const newEvidence: Evidence = { ...evidence, id: generateId('evidence') };
  return {
    ...state,
    evidence: [...state.evidence, newEvidence],
  };
}

export function computeStability(current: State, previous: State): number {
  if (current.claims.length === 0 && previous.claims.length === 0) {
    return 1;
  }

  const currentIds = new Set(current.claims.map(c => c.content));
  const previousIds = new Set(previous.claims.map(c => c.content));

  const added = [...currentIds].filter(id => !previousIds.has(id)).length;
  const removed = [...previousIds].filter(id => !currentIds.has(id)).length;
  const total = Math.max(currentIds.size, previousIds.size, 1);

  const claimDelta = (added + removed) / total;

  const currentConfidences = current.claims.map(c => c.confidence);
  const previousConfidences = previous.claims.map(c => c.confidence);
  const avgCurrent = currentConfidences.length > 0
    ? currentConfidences.reduce((a, b) => a + b, 0) / currentConfidences.length
    : 0;
  const avgPrevious = previousConfidences.length > 0
    ? previousConfidences.reduce((a, b) => a + b, 0) / previousConfidences.length
    : 0;
  const confidenceShift = Math.abs(avgCurrent - avgPrevious);

  return 1 - (claimDelta * 0.6 + confidenceShift * 0.4);
}

export interface StateDiff {
  claimsAdded: number;
  claimsRemoved: number;
  assumptionsAdded: number;
  assumptionsRemoved: number;
  evidenceAdded: number;
  openQuestionsAdded: number;
  openQuestionsResolved: number;
}

export function diffStates(current: State, previous: State): StateDiff {
  const currentClaimContents = new Set(current.claims.map(c => c.content));
  const previousClaimContents = new Set(previous.claims.map(c => c.content));

  const currentAssumptionContents = new Set(current.assumptions.map(a => a.content));
  const previousAssumptionContents = new Set(previous.assumptions.map(a => a.content));

  const currentQuestions = new Set(current.openQuestions);
  const previousQuestions = new Set(previous.openQuestions);

  return {
    claimsAdded: [...currentClaimContents].filter(c => !previousClaimContents.has(c)).length,
    claimsRemoved: [...previousClaimContents].filter(c => !currentClaimContents.has(c)).length,
    assumptionsAdded: [...currentAssumptionContents].filter(a => !previousAssumptionContents.has(a)).length,
    assumptionsRemoved: [...previousAssumptionContents].filter(a => !currentAssumptionContents.has(a)).length,
    evidenceAdded: current.evidence.length - previous.evidence.length,
    openQuestionsAdded: [...currentQuestions].filter(q => !previousQuestions.has(q)).length,
    openQuestionsResolved: [...previousQuestions].filter(q => !currentQuestions.has(q)).length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/state.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/state.ts tests/core/state.test.ts
git commit -m "feat: add state module with init, mutation, stability, and diff"
```

---

### Task 4: Scratchpad Module

**Files:**
- Create: `src/core/scratchpad.ts`
- Create: `tests/core/scratchpad.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/scratchpad.test.ts
import { describe, it, expect } from 'vitest';
import { buildScratchpadPrompt, extractStateFragment } from '../../src/core/scratchpad.js';
import { initState } from '../../src/core/state.js';

describe('Scratchpad Module', () => {
  describe('buildScratchpadPrompt', () => {
    it('should include the problem and current state context', () => {
      const state = initState('Design a microservices system');
      const prompt = buildScratchpadPrompt(state, 'expand');
      expect(prompt).toContain('Design a microservices system');
      expect(prompt).toContain('expand');
    });

    it('should include existing claims when present', () => {
      let state = initState('Test problem');
      state = {
        ...state,
        claims: [{
          id: 'c1',
          content: 'Existing claim',
          confidence: 0.8,
          source: 'scratchpad',
          evidence: [],
          iteration: 1,
        }],
      };
      const prompt = buildScratchpadPrompt(state, 'refine');
      expect(prompt).toContain('Existing claim');
    });

    it('should include open questions', () => {
      const state = initState('How to scale?');
      const prompt = buildScratchpadPrompt(state, 'expand');
      expect(prompt).toContain('How to scale?');
    });
  });

  describe('extractStateFragment', () => {
    it('should extract claims from scratchpad text', () => {
      const scratchpad = `
Let me think about this problem...

CLAIM: Microservices are suitable for large-scale systems
CLAIM: Monoliths are simpler to deploy initially

ASSUMPTION: The team has experience with distributed systems
ASSUMPTION: Budget allows for infrastructure overhead

EVIDENCE: Industry surveys show 60% adoption rate
EVIDENCE: Case studies demonstrate 3x deployment frequency

QUESTION: What is the expected traffic pattern?
QUESTION: How many services are needed initially?
      `;
      const fragment = extractStateFragment(scratchpad, 1);
      expect(fragment.claims.length).toBeGreaterThanOrEqual(2);
      expect(fragment.assumptions.length).toBeGreaterThanOrEqual(2);
      expect(fragment.evidence.length).toBeGreaterThanOrEqual(2);
      expect(fragment.openQuestions.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty scratchpad', () => {
      const fragment = extractStateFragment('', 1);
      expect(fragment.claims).toHaveLength(0);
      expect(fragment.assumptions).toHaveLength(0);
      expect(fragment.evidence).toHaveLength(0);
      expect(fragment.openQuestions).toHaveLength(0);
    });

    it('should assign correct iteration to extracted items', () => {
      const scratchpad = 'CLAIM: Test claim\nASSUMPTION: Test assumption';
      const fragment = extractStateFragment(scratchpad, 3);
      expect(fragment.claims[0]?.iteration).toBe(3);
      expect(fragment.assumptions[0]?.iteration).toBe(3);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/scratchpad.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/scratchpad.ts**

```typescript
import type { State, Claim, Assumption, Evidence, PolicyAction } from './types.js';

export function buildScratchpadPrompt(state: State, action: PolicyAction): string {
  const sections: string[] = [];

  sections.push(`## Current Task: ${action}`);
  sections.push('');

  if (state.openQuestions.length > 0) {
    sections.push('## Open Questions');
    state.openQuestions.forEach((q, i) => sections.push(`${i + 1}. ${q}`));
    sections.push('');
  }

  if (state.claims.length > 0) {
    sections.push('## Existing Claims');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }

  if (state.assumptions.length > 0) {
    sections.push('## Current Assumptions');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
    sections.push('');
  }

  if (state.evidence.length > 0) {
    sections.push('## Available Evidence');
    state.evidence.forEach(e => sections.push(`- [${e.type}] ${e.content}`));
    sections.push('');
  }

  sections.push('## Instructions');
  sections.push('Think freely about the problem. Use these prefixes to mark structured elements:');
  sections.push('- CLAIM: <factual assertion with confidence>');
  sections.push('- ASSUMPTION: <unstated premise>');
  sections.push('- EVIDENCE: <supporting data or observation>');
  sections.push('- QUESTION: <open question that needs resolution>');
  sections.push('');
  sections.push('Write your reasoning below:');

  return sections.join('\n');
}

interface ExtractedFragment {
  claims: Omit<Claim, 'id'>[];
  assumptions: Omit<Assumption, 'id'>[];
  evidence: Omit<Evidence, 'id'>[];
  openQuestions: string[];
}

export function extractStateFragment(scratchpad: string, iteration: number): ExtractedFragment {
  const fragment: ExtractedFragment = {
    claims: [],
    assumptions: [],
    evidence: [],
    openQuestions: [],
  };

  const lines = scratchpad.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    const claimMatch = trimmed.match(/^CLAIM:\s*(.+)/i);
    if (claimMatch) {
      fragment.claims.push({
        content: claimMatch[1].trim(),
        confidence: 0.5,
        source: 'scratchpad',
        evidence: [],
        iteration,
      });
      continue;
    }

    const assumptionMatch = trimmed.match(/^ASSUMPTION:\s*(.+)/i);
    if (assumptionMatch) {
      fragment.assumptions.push({
        content: assumptionMatch[1].trim(),
        status: 'unverified',
        challengedBy: [],
        iteration,
      });
      continue;
    }

    const evidenceMatch = trimmed.match(/^EVIDENCE:\s*(.+)/i);
    if (evidenceMatch) {
      fragment.evidence.push({
        content: evidenceMatch[1].trim(),
        type: 'logical',
        source: 'scratchpad',
        reliable: true,
        iteration,
      });
      continue;
    }

    const questionMatch = trimmed.match(/^QUESTION:\s*(.+)/i);
    if (questionMatch) {
      fragment.openQuestions.push(questionMatch[1].trim());
      continue;
    }
  }

  return fragment;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/scratchpad.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/scratchpad.ts tests/core/scratchpad.test.ts
git commit -m "feat: add scratchpad module with prompt building and extraction"
```

---

### Task 5: Critic Module

**Files:**
- Create: `src/core/critic.ts`
- Create: `tests/core/critic.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/critic.test.ts
import { describe, it, expect } from 'vitest';
import { buildCriticPrompt, parseCriticOutput } from '../../src/core/critic.js';
import { initState } from '../../src/core/state.js';
import type { CriticOutput } from '../../src/core/types.js';

describe('Critic Module', () => {
  describe('buildCriticPrompt', () => {
    it('should include claims to evaluate', () => {
      let state = initState('test');
      state = {
        ...state,
        claims: [{
          id: 'c1',
          content: 'Microservices are always better',
          confidence: 0.9,
          source: 'scratchpad',
          evidence: [],
          iteration: 1,
        }],
      };
      const prompt = buildCriticPrompt(state);
      expect(prompt).toContain('Microservices are always better');
    });

    it('should include assumptions to challenge', () => {
      let state = initState('test');
      state = {
        ...state,
        assumptions: [{
          id: 'a1',
          content: 'Team has DevOps experience',
          status: 'unverified',
          challengedBy: [],
          iteration: 1,
        }],
      };
      const prompt = buildCriticPrompt(state);
      expect(prompt).toContain('Team has DevOps experience');
    });
  });

  describe('parseCriticOutput', () => {
    it('should parse structured critic response', () => {
      const response = `
ISSUE: The claim "Microservices are always better" is an overgeneralization
ISSUE: No evidence provided for the 0.9 confidence level

RISK: Premature adoption of microservices without team readiness
RISK: Cost overrun from infrastructure complexity

CONTRADICTION: Claim says "always better" but evidence shows monoliths are simpler initially

SUGGESTION: Qualify the claim with specific conditions
SUGGESTION: Lower confidence to 0.6 until more evidence is gathered
      `;
      const output = parseCriticOutput(response);
      expect(output.issues).toHaveLength(2);
      expect(output.risks).toHaveLength(2);
      expect(output.contradictions).toHaveLength(1);
      expect(output.suggestions).toHaveLength(2);
    });

    it('should handle empty response', () => {
      const output = parseCriticOutput('');
      expect(output.issues).toHaveLength(0);
      expect(output.risks).toHaveLength(0);
      expect(output.contradictions).toHaveLength(0);
      expect(output.suggestions).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/critic.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/critic.ts**

```typescript
import type { State, CriticOutput } from './types.js';

export function buildCriticPrompt(state: State): string {
  const sections: string[] = [];

  sections.push('## Critic Evaluation');
  sections.push('');
  sections.push('Evaluate the following reasoning state for logical issues, risks, contradictions, and suggest improvements.');
  sections.push('');

  if (state.claims.length > 0) {
    sections.push('### Claims to Evaluate');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }

  if (state.assumptions.length > 0) {
    sections.push('### Assumptions to Challenge');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
    sections.push('');
  }

  if (state.evidence.length > 0) {
    sections.push('### Evidence to Verify');
    state.evidence.forEach(e => sections.push(`- [${e.type}] ${e.content}`));
    sections.push('');
  }

  sections.push('### Output Format');
  sections.push('Use these prefixes to mark your findings:');
  sections.push('- ISSUE: <logical problem or gap>');
  sections.push('- RISK: <potential negative outcome>');
  sections.push('- CONTRADICTION: <conflict between claims or evidence>');
  sections.push('- SUGGESTION: <recommended improvement>');

  return sections.join('\n');
}

export function parseCriticOutput(response: string): CriticOutput {
  const output: CriticOutput = {
    issues: [],
    risks: [],
    contradictions: [],
    suggestions: [],
  };

  const lines = response.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    const issueMatch = trimmed.match(/^ISSUE:\s*(.+)/i);
    if (issueMatch) {
      output.issues.push(issueMatch[1].trim());
      continue;
    }

    const riskMatch = trimmed.match(/^RISK:\s*(.+)/i);
    if (riskMatch) {
      output.risks.push(riskMatch[1].trim());
      continue;
    }

    const contradictionMatch = trimmed.match(/^CONTRADICTION:\s*(.+)/i);
    if (contradictionMatch) {
      output.contradictions.push(contradictionMatch[1].trim());
      continue;
    }

    const suggestionMatch = trimmed.match(/^SUGGESTION:\s*(.+)/i);
    if (suggestionMatch) {
      output.suggestions.push(suggestionMatch[1].trim());
      continue;
    }
  }

  return output;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/critic.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/critic.ts tests/core/critic.test.ts
git commit -m "feat: add critic module with prompt building and output parsing"
```

---

### Task 6: Adversary Module

**Files:**
- Create: `src/core/adversary.ts`
- Create: `tests/core/adversary.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/adversary.test.ts
import { describe, it, expect } from 'vitest';
import { buildAdversaryPrompt, parseAdversaryOutput } from '../../src/core/adversary.js';
import { initState } from '../../src/core/state.js';

describe('Adversary Module', () => {
  describe('buildAdversaryPrompt', () => {
    it('should instruct adversary to attack claims', () => {
      let state = initState('test');
      state = {
        ...state,
        claims: [{
          id: 'c1',
          content: 'REST is the best API style',
          confidence: 0.9,
          source: 'scratchpad',
          evidence: [],
          iteration: 1,
        }],
        assumptions: [{
          id: 'a1',
          content: 'All clients support HTTP/2',
          status: 'unverified',
          challengedBy: [],
          iteration: 1,
        }],
      };
      const prompt = buildAdversaryPrompt(state);
      expect(prompt).toContain('REST is the best API style');
      expect(prompt).toContain('All clients support HTTP/2');
    });
  });

  describe('parseAdversaryOutput', () => {
    it('should parse adversary response with same format as critic', () => {
      const response = `
ISSUE: Counter-example: gRPC outperforms REST for internal services
ISSUE: GraphQL offers better flexibility for complex queries

RISK: REST may lead to over-fetching in mobile scenarios
RISK: Tight coupling to HTTP semantics limits protocol flexibility

CONTRADICTION: "Best" is context-dependent; REST excels in public APIs but not necessarily internal ones

SUGGESTION: Narrow the claim to "REST is the best API style for public-facing services"
      `;
      const output = parseAdversaryOutput(response);
      expect(output.issues).toHaveLength(2);
      expect(output.risks).toHaveLength(2);
      expect(output.contradictions).toHaveLength(1);
      expect(output.suggestions).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/adversary.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/adversary.ts**

```typescript
import type { State, CriticOutput } from './types.js';

export function buildAdversaryPrompt(state: State): string {
  const sections: string[] = [];

  sections.push('## Adversary Attack');
  sections.push('');
  sections.push('Your role is to actively attack and undermine the reasoning below. Construct counter-examples, break assumptions, and identify edge cases where the claims fail.');
  sections.push('');

  if (state.claims.length > 0) {
    sections.push('### Claims to Attack');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }

  if (state.assumptions.length > 0) {
    sections.push('### Assumptions to Break');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
    sections.push('');
  }

  sections.push('### Attack Strategies');
  sections.push('- Construct counter-examples that invalidate claims');
  sections.push('- Identify edge cases and extreme scenarios');
  sections.push('- Challenge assumptions with contradictory evidence');
  sections.push('- Find hidden dependencies or prerequisites');
  sections.push('');

  sections.push('### Output Format');
  sections.push('- ISSUE: <counter-example or logical attack>');
  sections.push('- RISK: <scenario where the reasoning fails>');
  sections.push('- CONTRADICTION: <direct conflict with existing claims>');
  sections.push('- SUGGESTION: <how to make the claim more robust>');

  return sections.join('\n');
}

export function parseAdversaryOutput(response: string): CriticOutput {
  const output: CriticOutput = {
    issues: [],
    risks: [],
    contradictions: [],
    suggestions: [],
  };

  const lines = response.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    const issueMatch = trimmed.match(/^ISSUE:\s*(.+)/i);
    if (issueMatch) { output.issues.push(issueMatch[1].trim()); continue; }

    const riskMatch = trimmed.match(/^RISK:\s*(.+)/i);
    if (riskMatch) { output.risks.push(riskMatch[1].trim()); continue; }

    const contradictionMatch = trimmed.match(/^CONTRADICTION:\s*(.+)/i);
    if (contradictionMatch) { output.contradictions.push(contradictionMatch[1].trim()); continue; }

    const suggestionMatch = trimmed.match(/^SUGGESTION:\s*(.+)/i);
    if (suggestionMatch) { output.suggestions.push(suggestionMatch[1].trim()); continue; }
  }

  return output;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/adversary.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/adversary.ts tests/core/adversary.test.ts
git commit -m "feat: add adversary module with attack prompt and output parsing"
```

---

### Task 7: Policy Module

**Files:**
- Create: `src/core/policy.ts`
- Create: `tests/core/policy.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/policy.test.ts
import { describe, it, expect } from 'vitest';
import { decide } from '../../src/core/policy.js';
import { initState } from '../../src/core/state.js';
import type { ConvergenceConfig } from '../../src/core/types.js';

const defaultConfig: ConvergenceConfig = {
  maxIterations: 10,
  budgetLimit: 100000,
  stabilityThreshold: 0.85,
  minIterations: 2,
};

describe('Policy Module', () => {
  describe('decide', () => {
    it('should expand on first iteration', () => {
      const state = initState('test');
      const decision = decide(state, defaultConfig);
      expect(decision.nextAction).toBe('expand');
    });

    it('should stop when max iterations reached', () => {
      const state = { ...initState('test'), iteration: 10 };
      const decision = decide(state, defaultConfig);
      expect(decision.nextAction).toBe('stop');
    });

    it('should stop when stability exceeds threshold after min iterations', () => {
      const state = {
        ...initState('test'),
        iteration: 3,
        metadata: { ...initState('test').metadata, stability: 0.9 },
      };
      const decision = decide(state, defaultConfig);
      expect(decision.nextAction).toBe('stop');
    });

    it('should not stop before min iterations even with high stability', () => {
      const state = {
        ...initState('test'),
        iteration: 1,
        metadata: { ...initState('test').metadata, stability: 0.95 },
      };
      const decision = decide(state, defaultConfig);
      expect(decision.nextAction).not.toBe('stop');
    });

    it('should switch to refine when budget is low', () => {
      const state = {
        ...initState('test'),
        iteration: 3,
        metadata: { ...initState('test').metadata, budgetRemaining: 10000, stability: 0.3 },
      };
      const decision = decide(state, { ...defaultConfig, budgetLimit: 100000 });
      expect(decision.nextAction).toBe('refine');
    });

    it('should trigger adversary periodically', () => {
      const state = {
        ...initState('test'),
        iteration: 4,
        metadata: { ...initState('test').metadata, stability: 0.4 },
      };
      const decision = decide(state, defaultConfig);
      expect(decision.nextAction).toBe('adversary');
    });

    it('should verify when there are unverified assumptions', () => {
      let state = initState('test');
      state = {
        ...state,
        iteration: 2,
        assumptions: [{
          id: 'a1',
          content: 'Test assumption',
          status: 'unverified',
          challengedBy: [],
          iteration: 1,
        }],
        metadata: { ...state.metadata, stability: 0.5 },
      };
      const decision = decide(state, defaultConfig);
      expect(['verify', 'adversary']).toContain(decision.nextAction);
    });

    it('should always provide reasoning', () => {
      const state = initState('test');
      const decision = decide(state, defaultConfig);
      expect(decision.reasoning).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/policy.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/policy.ts**

```typescript
import type { State, PolicyDecision, ConvergenceConfig } from './types.js';

export function decide(state: State, config: ConvergenceConfig): PolicyDecision {
  const { iteration, metadata, assumptions, openQuestions } = state;
  const { stability, budgetRemaining } = metadata;

  // Hard stop conditions
  if (iteration >= config.maxIterations) {
    return { nextAction: 'stop', activeViews: [], toolEnabled: false, reasoning: 'Max iterations reached' };
  }

  if (iteration >= config.minIterations && stability >= config.stabilityThreshold) {
    return { nextAction: 'stop', activeViews: [], toolEnabled: false, reasoning: `Stability ${stability.toFixed(2)} exceeds threshold ${config.stabilityThreshold}` };
  }

  if (budgetRemaining <= 0) {
    return { nextAction: 'stop', activeViews: [], toolEnabled: false, reasoning: 'Budget exhausted' };
  }

  // Budget-aware: low budget → refine
  const budgetRatio = budgetRemaining / config.budgetLimit;
  if (budgetRatio < 0.2 && iteration >= config.minIterations) {
    return {
      nextAction: 'refine',
      activeViews: [],
      toolEnabled: false,
      reasoning: `Low budget (${(budgetRatio * 100).toFixed(0)}% remaining), switching to refine mode`,
    };
  }

  // First iteration → expand
  if (iteration === 0) {
    return {
      nextAction: 'expand',
      activeViews: ['causal', 'structural'],
      toolEnabled: false,
      reasoning: 'Initial exploration, expanding reasoning with causal and structural views',
    };
  }

  // Periodic adversary (every 3rd iteration starting from iteration 4)
  if (iteration >= 4 && iteration % 3 === 1 && stability < config.stabilityThreshold) {
    return {
      nextAction: 'adversary',
      activeViews: ['constraint'],
      toolEnabled: true,
      reasoning: `Periodic adversary check at iteration ${iteration}`,
    };
  }

  // Unverified assumptions → verify
  const unverifiedCount = assumptions.filter(a => a.status === 'unverified').length;
  if (unverifiedCount > 0 && iteration >= 2) {
    return {
      nextAction: 'verify',
      activeViews: [],
      toolEnabled: true,
      reasoning: `${unverifiedCount} unverified assumptions need validation`,
    };
  }

  // Low stability → expand
  if (stability < 0.4) {
    return {
      nextAction: 'expand',
      activeViews: ['causal', 'comparative'],
      toolEnabled: false,
      reasoning: `Low stability (${stability.toFixed(2)}), expanding reasoning`,
    };
  }

  // Medium stability → refine
  if (stability < config.stabilityThreshold) {
    return {
      nextAction: 'refine',
      activeViews: ['constraint'],
      toolEnabled: true,
      reasoning: `Medium stability (${stability.toFixed(2)}), refining with constraints`,
    };
  }

  // Default: refine
  return {
    nextAction: 'refine',
    activeViews: [],
    toolEnabled: false,
    reasoning: 'Defaulting to refine mode',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/policy.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/policy.ts tests/core/policy.test.ts
git commit -m "feat: add policy controller with budget-aware decision logic"
```

---

### Task 8: Transition Module

**Files:**
- Create: `src/core/transition.ts`
- Create: `tests/core/transition.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/transition.test.ts
import { describe, it, expect } from 'vitest';
import { transition } from '../../src/core/transition.js';
import { initState } from '../../src/core/state.js';
import type { TransitionInput, CriticOutput } from '../../src/core/types.js';

describe('Transition Module', () => {
  describe('transition', () => {
    it('should increment iteration', () => {
      const state = initState('test');
      const input: TransitionInput = {
        scratchpad: '',
        stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
        critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
        adversary: null,
        toolResults: [],
        viewResults: [],
      };
      const newState = transition(state, input);
      expect(newState.iteration).toBe(1);
    });

    it('should merge claims from state fragment', () => {
      const state = initState('test');
      const input: TransitionInput = {
        scratchpad: '',
        stateFragment: {
          claims: [{
            id: 'c1',
            content: 'New claim',
            confidence: 0.7,
            source: 'scratchpad',
            evidence: [],
            iteration: 1,
          }],
          assumptions: [],
          evidence: [],
          openQuestions: [],
        },
        critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
        adversary: null,
        toolResults: [],
        viewResults: [],
      };
      const newState = transition(state, input);
      expect(newState.claims).toHaveLength(1);
      expect(newState.claims[0].content).toBe('New claim');
    });

    it('should deduplicate claims with same content', () => {
      const state = {
        ...initState('test'),
        claims: [{
          id: 'c0',
          content: 'Same claim',
          confidence: 0.6,
          source: 'scratchpad',
          evidence: [],
          iteration: 0,
        }],
      };
      const input: TransitionInput = {
        scratchpad: '',
        stateFragment: {
          claims: [{
            id: 'c1',
            content: 'Same claim',
            confidence: 0.8,
            source: 'critic',
            evidence: [],
            iteration: 1,
          }],
          assumptions: [],
          evidence: [],
          openQuestions: [],
        },
        critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
        adversary: null,
        toolResults: [],
        viewResults: [],
      };
      const newState = transition(state, input);
      expect(newState.claims).toHaveLength(1);
      expect(newState.claims[0].confidence).toBe(0.8); // higher confidence wins
    });

    it('should update lastAction from policy decision', () => {
      const state = initState('test');
      const input: TransitionInput = {
        scratchpad: '',
        stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
        critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
        adversary: null,
        toolResults: [],
        viewResults: [],
      };
      const newState = transition(state, input, 'expand');
      expect(newState.metadata.lastAction).toBe('expand');
    });

    it('should add tool results as evidence', () => {
      const state = initState('test');
      const input: TransitionInput = {
        scratchpad: '',
        stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
        critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
        adversary: null,
        toolResults: [{
          toolName: 'code_exec',
          success: true,
          output: 'result: 42',
        }],
        viewResults: [],
      };
      const newState = transition(state, input);
      expect(newState.evidence).toHaveLength(1);
      expect(newState.evidence[0].type).toBe('tool_result');
      expect(newState.evidence[0].source).toBe('code_exec');
    });

    it('should mark assumptions as challenged when adversary finds issues', () => {
      const state = {
        ...initState('test'),
        assumptions: [{
          id: 'a1',
          content: 'Team has DevOps experience',
          status: 'unverified' as const,
          challengedBy: [],
          iteration: 0,
        }],
      };
      const input: TransitionInput = {
        scratchpad: '',
        stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
        critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
        adversary: {
          issues: ['Team may not have DevOps experience'],
          risks: ['Deployment failures'],
          contradictions: [],
          suggestions: ['Verify team capabilities'],
        },
        toolResults: [],
        viewResults: [],
      };
      const newState = transition(state, input);
      expect(newState.assumptions[0].status).toBe('challenged');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/transition.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/transition.ts**

```typescript
import type { State, TransitionInput, Claim, Assumption, Evidence, PolicyAction } from './types.js';
import { computeStability } from './state.js';

export function transition(
  currentState: State,
  input: TransitionInput,
  action?: PolicyAction,
): State {
  const { stateFragment, critic, adversary, toolResults, viewResults } = input;

  // Merge claims (deduplicate by content, keep higher confidence)
  const mergedClaims = mergeClaims(currentState.claims, stateFragment.claims ?? []);

  // Merge assumptions
  const mergedAssumptions = mergeAssumptions(
    currentState.assumptions,
    stateFragment.assumptions ?? [],
    adversary,
  );

  // Merge evidence
  const mergedEvidence = mergeEvidence(currentState.evidence, stateFragment.evidence ?? []);

  // Add tool results as evidence
  const toolEvidence: Evidence[] = toolResults
    .filter(r => r.success)
    .map(r => ({
      id: `evidence-tool-${r.toolName}-${currentState.iteration + 1}`,
      content: r.output,
      type: 'tool_result' as const,
      source: r.toolName,
      reliable: true,
      iteration: currentState.iteration + 1,
    }));

  // Merge open questions
  const existingQuestions = new Set(currentState.openQuestions);
  const newQuestions = (stateFragment.openQuestions ?? []).filter(q => !existingQuestions.has(q));
  const mergedOpenQuestions = [...currentState.openQuestions, ...newQuestions];

  // Merge view results
  if (viewResults.length > 0) {
    for (const vr of viewResults) {
      for (const claim of vr.state.claims) {
        const existing = mergedClaims.find(c => c.content === claim.content);
        if (!existing) {
          mergedClaims.push({ ...claim, source: 'view', iteration: currentState.iteration + 1 });
        } else if (claim.confidence > existing.confidence) {
          existing.confidence = claim.confidence;
        }
      }
    }
  }

  // Build new state
  const newState: State = {
    iteration: currentState.iteration + 1,
    claims: mergedClaims,
    assumptions: mergedAssumptions,
    evidence: [...mergedEvidence, ...toolEvidence],
    openQuestions: mergedOpenQuestions,
    controversies: currentState.controversies,
    metadata: {
      stability: 0, // computed below
      lastAction: action ?? currentState.metadata.lastAction,
      budgetRemaining: currentState.metadata.budgetRemaining,
      totalTokensUsed: currentState.metadata.totalTokensUsed,
    },
  };

  // Compute stability
  newState.metadata.stability = computeStability(newState, currentState);

  return newState;
}

function mergeClaims(existing: Claim[], incoming: Claim[]): Claim[] {
  const result = [...existing];
  for (const claim of incoming) {
    const existingIdx = result.findIndex(c => c.content === claim.content);
    if (existingIdx >= 0) {
      // Keep higher confidence
      if (claim.confidence > result[existingIdx].confidence) {
        result[existingIdx] = { ...result[existingIdx], confidence: claim.confidence };
      }
    } else {
      result.push(claim);
    }
  }
  return result;
}

function mergeAssumptions(
  existing: Assumption[],
  incoming: Assumption[],
  adversary: TransitionInput['adversary'],
): Assumption[] {
  const result = [...existing, ...incoming];

  // If adversary found issues, mark unverified assumptions as challenged
  if (adversary && adversary.issues.length > 0) {
    for (const assumption of result) {
      if (assumption.status === 'unverified') {
        assumption.status = 'challenged';
        assumption.challengedBy = adversary.issues.slice(0, 3);
      }
    }
  }

  return result;
}

function mergeEvidence(existing: Evidence[], incoming: Evidence[]): Evidence[] {
  const existingContents = new Set(existing.map(e => e.content));
  return [...existing, ...incoming.filter(e => !existingContents.has(e.content))];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/transition.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/transition.ts tests/core/transition.test.ts
git commit -m "feat: add state transition engine with claim dedup and adversary integration"
```

---

### Task 9: Convergence Module

**Files:**
- Create: `src/core/convergence.ts`
- Create: `tests/core/convergence.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/convergence.test.ts
import { describe, it, expect } from 'vitest';
import { checkConvergence } from '../../src/core/convergence.js';
import { initState } from '../../src/core/state.js';
import type { ConvergenceConfig } from '../../src/core/types.js';

const defaultConfig: ConvergenceConfig = {
  maxIterations: 10,
  budgetLimit: 100000,
  stabilityThreshold: 0.85,
  minIterations: 2,
};

describe('Convergence Module', () => {
  it('should not converge before min iterations', () => {
    const state = { ...initState('test'), iteration: 1 };
    expect(checkConvergence(state, defaultConfig)).toBe(false);
  });

  it('should converge when max iterations reached', () => {
    const state = { ...initState('test'), iteration: 10 };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });

  it('should converge when stability exceeds threshold after min iterations', () => {
    const state = {
      ...initState('test'),
      iteration: 3,
      metadata: { ...initState('test').metadata, stability: 0.9 },
    };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });

  it('should converge when budget exhausted', () => {
    const state = {
      ...initState('test'),
      iteration: 3,
      metadata: { ...initState('test').metadata, budgetRemaining: 0 },
    };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });

  it('should not converge with high stability before min iterations', () => {
    const state = {
      ...initState('test'),
      iteration: 1,
      metadata: { ...initState('test').metadata, stability: 0.95 },
    };
    expect(checkConvergence(state, defaultConfig)).toBe(false);
  });

  it('should not converge when conditions not met', () => {
    const state = {
      ...initState('test'),
      iteration: 3,
      metadata: { ...initState('test').metadata, stability: 0.5, budgetRemaining: 50000 },
    };
    expect(checkConvergence(state, defaultConfig)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/convergence.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/convergence.ts**

```typescript
import type { State, ConvergenceConfig } from './types.js';

export function checkConvergence(state: State, config: ConvergenceConfig): boolean {
  if (state.iteration < config.minIterations) return false;
  if (state.iteration >= config.maxIterations) return true;
  if (state.metadata.budgetRemaining <= 0) return true;
  if (state.metadata.stability >= config.stabilityThreshold) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/convergence.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/convergence.ts tests/core/convergence.test.ts
git commit -m "feat: add convergence detection module"
```

---

### Task 10: Multi-View Module

**Files:**
- Create: `src/core/multi-view.ts`
- Create: `tests/core/multi-view.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/multi-view.test.ts
import { describe, it, expect } from 'vitest';
import { buildViewPrompt, fuseViews } from '../../src/core/multi-view.js';
import { initState } from '../../src/core/state.js';
import type { ViewResult, ViewType } from '../../src/core/types.js';

describe('Multi-View Module', () => {
  describe('buildViewPrompt', () => {
    it('should build causal view prompt', () => {
      const state = initState('Why does the system fail under load?');
      const prompt = buildViewPrompt('causal', state);
      expect(prompt).toContain('causal');
      expect(prompt).toContain('Why does the system fail under load?');
    });

    it('should build structural view prompt', () => {
      const state = initState('Design the system architecture');
      const prompt = buildViewPrompt('structural', state);
      expect(prompt).toContain('structural');
    });

    it('should build constraint view prompt', () => {
      const state = initState('What are the limitations?');
      const prompt = buildViewPrompt('constraint', state);
      expect(prompt).toContain('constraint');
    });

    it('should build comparative view prompt', () => {
      const state = initState('Compare approaches');
      const prompt = buildViewPrompt('comparative', state);
      expect(prompt).toContain('comparative');
    });
  });

  describe('fuseViews', () => {
    it('should merge claims from multiple views', () => {
      const baseState = initState('test');
      const viewResults: ViewResult[] = [
        {
          viewName: 'causal',
          state: {
            ...baseState,
            claims: [{
              id: 'c1',
              content: 'A causes B',
              confidence: 0.8,
              source: 'view',
              evidence: [],
              iteration: 1,
            }],
          },
          confidence: 0.7,
        },
        {
          viewName: 'structural',
          state: {
            ...baseState,
            claims: [{
              id: 'c2',
              content: 'A and B are separate modules',
              confidence: 0.9,
              source: 'view',
              evidence: [],
              iteration: 1,
            }],
          },
          confidence: 0.8,
        },
      ];

      const fused = fuseViews(viewResults, baseState);
      expect(fused.claims.length).toBeGreaterThanOrEqual(2);
    });

    it('should deduplicate claims across views, keeping higher confidence', () => {
      const baseState = initState('test');
      const viewResults: ViewResult[] = [
        {
          viewName: 'causal',
          state: {
            ...baseState,
            claims: [{
              id: 'c1',
              content: 'Same claim',
              confidence: 0.7,
              source: 'view',
              evidence: [],
              iteration: 1,
            }],
          },
          confidence: 0.7,
        },
        {
          viewName: 'structural',
          state: {
            ...baseState,
            claims: [{
              id: 'c2',
              content: 'Same claim',
              confidence: 0.9,
              source: 'view',
              evidence: [],
              iteration: 1,
            }],
          },
          confidence: 0.8,
        },
      ];

      const fused = fuseViews(viewResults, baseState);
      expect(fused.claims).toHaveLength(1);
      expect(fused.claims[0].confidence).toBe(0.9);
    });

    it('should mark contradictory claims as controversies', () => {
      const baseState = initState('test');
      const viewResults: ViewResult[] = [
        {
          viewName: 'causal',
          state: {
            ...baseState,
            claims: [{
              id: 'c1',
              content: 'Microservices are better',
              confidence: 0.8,
              source: 'view',
              evidence: [],
              iteration: 1,
            }],
          },
          confidence: 0.7,
        },
        {
          viewName: 'constraint',
          state: {
            ...baseState,
            claims: [{
              id: 'c2',
              content: 'Microservices are NOT better for small teams',
              confidence: 0.7,
              source: 'view',
              evidence: [],
              iteration: 1,
            }],
          },
          confidence: 0.8,
        },
      ];

      const fused = fuseViews(viewResults, baseState);
      expect(fused.controversies.length).toBeGreaterThanOrEqual(1);
    });

    it('should return base state when no views provided', () => {
      const baseState = initState('test');
      const fused = fuseViews([], baseState);
      expect(fused).toEqual(baseState);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/multi-view.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/multi-view.ts**

```typescript
import type { State, ViewResult, ViewType, Claim, Controversy } from './types.js';

const VIEW_PROMPTS: Record<ViewType, { focus: string; instructions: string }> = {
  causal: {
    focus: 'Cause and effect relationships',
    instructions: 'Focus on WHY things happen. Trace causal chains. Identify root causes and effects. Consider: "If X, then Y because..."',
  },
  structural: {
    focus: 'System structure and composition',
    instructions: 'Focus on HOW parts compose the whole. Identify components, boundaries, and interfaces. Consider: "The system consists of... which interact via..."',
  },
  constraint: {
    focus: 'Limitations and failure conditions',
    instructions: 'Focus on WHEN things break. Identify constraints, preconditions, and edge cases. Consider: "This fails when..." or "This requires..."',
  },
  comparative: {
    focus: 'Comparative analysis with alternatives',
    instructions: 'Focus on HOW this compares to alternatives. Identify trade-offs, strengths, and weaknesses. Consider: "Compared to X, this approach..."',
  },
};

export function buildViewPrompt(viewType: ViewType, state: State): string {
  const viewConfig = VIEW_PROMPTS[viewType];
  const sections: string[] = [];

  sections.push(`## ${viewType.toUpperCase()} VIEW: ${viewConfig.focus}`);
  sections.push('');
  sections.push(viewConfig.instructions);
  sections.push('');

  if (state.openQuestions.length > 0) {
    sections.push('### Problem Context');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
    sections.push('');
  }

  if (state.claims.length > 0) {
    sections.push('### Existing Claims (for context)');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content}`));
    sections.push('');
  }

  sections.push('### Output Format');
  sections.push('Use these prefixes:');
  sections.push('- CLAIM: <assertion from this viewpoint>');
  sections.push('- ASSUMPTION: <assumption from this viewpoint>');
  sections.push('- EVIDENCE: <supporting evidence>');
  sections.push('- QUESTION: <open question from this viewpoint>');

  return sections.join('\n');
}

export function fuseViews(viewResults: ViewResult[], baseState: State): State {
  if (viewResults.length === 0) return baseState;

  const allClaims: Claim[] = [];
  const controversies: Controversy[] = [...baseState.controversies];

  for (const vr of viewResults) {
    allClaims.push(...vr.state.claims);
  }

  // Deduplicate claims, keeping higher confidence
  const mergedClaims: Claim[] = [];
  for (const claim of allClaims) {
    const existing = mergedClaims.find(c => c.content === claim.content);
    if (!existing) {
      mergedClaims.push({ ...claim, source: 'view' });
    } else if (claim.confidence > existing.confidence) {
      existing.confidence = claim.confidence;
    }
  }

  // Detect contradictions (simple heuristic: negation patterns)
  for (let i = 0; i < mergedClaims.length; i++) {
    for (let j = i + 1; j < mergedClaims.length; j++) {
      const a = mergedClaims[i].content.toLowerCase();
      const b = mergedClaims[j].content.toLowerCase();
      if ((a.includes('not') && b.replace(/\bnot\b/, '').trim() === a.replace(/\bnot\b/, '').trim()) ||
          (b.includes('not') && a.replace(/\bnot\b/, '').trim() === b.replace(/\bnot\b/, '').trim())) {
        const controversy: Controversy = {
          id: `controversy-${controversies.length + 1}`,
          description: `Conflict between: "${mergedClaims[i].content}" and "${mergedClaims[j].content}"`,
          positions: [mergedClaims[i].id, mergedClaims[j].id],
          resolved: false,
        };
        controversies.push(controversy);
      }
    }
  }

  // Merge evidence from all views
  const allEvidence = viewResults.flatMap(vr => vr.state.evidence);
  const existingEvidenceContents = new Set(baseState.evidence.map(e => e.content));
  const newEvidence = allEvidence.filter(e => !existingEvidenceContents.has(e.content));

  // Merge open questions
  const allQuestions = viewResults.flatMap(vr => vr.state.openQuestions);
  const existingQuestions = new Set(baseState.openQuestions);
  const newQuestions = allQuestions.filter(q => !existingQuestions.has(q));

  return {
    ...baseState,
    claims: mergedClaims,
    evidence: [...baseState.evidence, ...newEvidence],
    openQuestions: [...baseState.openQuestions, ...newQuestions],
    controversies,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/core/multi-view.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/multi-view.ts tests/core/multi-view.test.ts
git commit -m "feat: add multi-view reasoning with prompt building and view fusion"
```

---

### Task 11: LLM Provider Abstraction

**Files:**
- Create: `src/engine/provider.ts`
- Create: `src/engine/providers/openai.ts`
- Create: `src/engine/providers/claude.ts`
- Create: `tests/engine/provider.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/engine/provider.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createProvider } from '../../src/engine/provider.js';

describe('Provider Module', () => {
  describe('createProvider', () => {
    it('should create OpenAI provider', () => {
      const provider = createProvider('openai', { apiKey: 'test-key' });
      expect(provider.name).toBe('openai');
    });

    it('should create Claude provider', () => {
      const provider = createProvider('claude', { apiKey: 'test-key' });
      expect(provider.name).toBe('claude');
    });

    it('should throw for unknown provider type', () => {
      expect(() => createProvider('unknown' as any, { apiKey: 'test' })).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/provider.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/engine/provider.ts**

```typescript
import type { LLMProvider, LLMOptions, LLMResponse } from './types.js';

// Re-export provider types
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

export { LLMProvider, LLMOptions, LLMResponse };

// Internal types (will be defined in a shared engine types file)
interface InternalLLMProvider {
  name: string;
  complete(prompt: string, options: LLMOptions): Promise<LLMResponse>;
}

interface InternalLLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface InternalLLMResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export { InternalLLMProvider as LLMProvider, InternalLLMOptions as LLMOptions, InternalLLMResponse as LLMResponse };

import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';

export function createProvider(type: 'openai' | 'claude', config: ProviderConfig): InternalLLMProvider {
  switch (type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
```

Wait — this has a circular re-export issue. Let me simplify.

- [ ] **Step 3 (revised): Write src/engine/provider.ts**

```typescript
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface LLMProvider {
  name: string;
  complete(prompt: string, options: LLMOptions): Promise<LLMResponse>;
}

export interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export function createProvider(type: 'openai' | 'claude', config: ProviderConfig): LLMProvider {
  switch (type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

// Import after interface definitions to avoid circular deps
import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';
```

- [ ] **Step 4: Write src/engine/providers/openai.ts**

```typescript
import OpenAI from 'openai';
import type { LLMProvider, LLMOptions, LLMResponse, ProviderConfig } from '../provider.js';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async complete(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const usage = response.usage;

    return {
      content,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
    };
  }
}
```

- [ ] **Step 5: Write src/engine/providers/claude.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMOptions, LLMResponse, ProviderConfig } from '../provider.js';

export class ClaudeProvider implements LLMProvider {
  name = 'claude';
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async complete(prompt: string, options: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 2000,
      system: options.systemPrompt ?? 'You are a reasoning assistant.',
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
    });

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run tests/engine/provider.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/provider.ts src/engine/providers/ tests/engine/provider.test.ts
git commit -m "feat: add LLM provider abstraction with OpenAI and Claude implementations"
```

---

### Task 12: Tool Grounding Layer

**Files:**
- Create: `src/engine/tools/registry.ts`
- Create: `src/engine/tools/sandbox.ts`
- Create: `src/engine/tools/http.ts`
- Create: `src/engine/tools/filesystem.ts`
- Create: `tests/engine/tools/registry.test.ts`
- Create: `tests/engine/tools/sandbox.test.ts`
- Create: `tests/engine/tools/http.test.ts`
- Create: `tests/engine/tools/filesystem.test.ts`

- [ ] **Step 1: Write the tests for registry**

```typescript
// tests/engine/tools/registry.test.ts
import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../../src/engine/tools/registry.js';
import type { Tool, ToolResult } from '../../../src/core/types.js';

const mockTool: Tool = {
  name: 'mock',
  description: 'A mock tool for testing',
  parameters: { type: 'object', properties: {} },
  execute: async () => ({ toolName: 'mock', success: true, output: 'mock result' }),
};

describe('ToolRegistry', () => {
  it('should register and retrieve a tool', () => {
    const registry = new ToolRegistry();
    registry.register(mockTool);
    expect(registry.get('mock')).toBe(mockTool);
  });

  it('should list all registered tools', () => {
    const registry = new ToolRegistry();
    registry.register(mockTool);
    expect(registry.list()).toHaveLength(1);
  });

  it('should execute a registered tool', async () => {
    const registry = new ToolRegistry();
    registry.register(mockTool);
    const result = await registry.execute('mock', {});
    expect(result.success).toBe(true);
    expect(result.output).toBe('mock result');
  });

  it('should throw when executing unregistered tool', async () => {
    const registry = new ToolRegistry();
    await expect(registry.execute('nonexistent', {})).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Write src/engine/tools/registry.ts**

```typescript
import type { Tool, ToolResult } from '../../core/types.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool;
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.get(name);
    return tool.execute(params);
  }
}
```

- [ ] **Step 3: Write src/engine/tools/sandbox.ts**

```typescript
import type { Tool, ToolResult } from '../../core/types.js';
import ivm from 'isolated-vm';

export const sandboxTool: Tool = {
  name: 'code_exec',
  description: 'Execute JavaScript code in a sandboxed environment. Returns the result of the last expression.',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'JavaScript code to execute' },
      timeout: { type: 'number', description: 'Timeout in ms (default 5000)' },
    },
    required: ['code'],
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const code = String(params.code ?? '');
    const timeout = Number(params.timeout ?? 5000);

    try {
      const isolate = new ivm.Isolate({ memoryLimit: 8 });
      const context = isolate.createContextSync();
      const jail = context.global;

      // Set up console.log capture
      const logs: string[] = [];
      jail.setSync('log', (...args: unknown[]) => {
        logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      });

      const script = isolate.compileScriptSync(code);
      const result = await script.run(context, { timeout, promise: true });

      isolate.dispose();

      const output = [
        ...(logs.length > 0 ? logs : []),
        result !== undefined ? String(result) : '',
      ].filter(Boolean).join('\n');

      return { toolName: 'code_exec', success: true, output: output || '(no output)' };
    } catch (err: unknown) {
      return {
        toolName: 'code_exec',
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
```

- [ ] **Step 4: Write src/engine/tools/http.ts**

```typescript
import type { Tool, ToolResult } from '../../core/types.js';

export const httpTool: Tool = {
  name: 'http_request',
  description: 'Make an HTTP GET request to a URL. Returns the response body.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to request' },
      method: { type: 'string', description: 'HTTP method (default GET)' },
      headers: { type: 'object', description: 'Request headers' },
    },
    required: ['url'],
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const url = String(params.url ?? '');
    const method = String(params.method ?? 'GET').toUpperCase();
    const headers = (params.headers as Record<string, string>) ?? {};

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          toolName: 'http_request',
          success: false,
          output: '',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const body = await response.text();
      const truncated = body.length > 10000 ? body.slice(0, 10000) + '...(truncated)' : body;

      return { toolName: 'http_request', success: true, output: truncated };
    } catch (err: unknown) {
      return {
        toolName: 'http_request',
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
```

- [ ] **Step 5: Write src/engine/tools/filesystem.ts**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolResult } from '../../core/types.js';

let workingDirectory: string = process.cwd();

export function setWorkingDirectory(dir: string): void {
  workingDirectory = path.resolve(dir);
}

function sanitizePath(filePath: string): string {
  const resolved = path.resolve(workingDirectory, filePath);
  if (!resolved.startsWith(workingDirectory)) {
    throw new Error(`Path escapes working directory: ${filePath}`);
  }
  return resolved;
}

export const filesystemTool: Tool = {
  name: 'file_read',
  description: 'Read a file from the working directory. Read-only access.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Relative file path within working directory' },
    },
    required: ['path'],
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = String(params.path ?? '');

    try {
      const sanitizedPath = sanitizePath(filePath);
      const content = await fs.readFile(sanitizedPath, 'utf-8');
      const truncated = content.length > 50000 ? content.slice(0, 50000) + '...(truncated)' : content;

      return { toolName: 'file_read', success: true, output: truncated };
    } catch (err: unknown) {
      return {
        toolName: 'file_read',
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
```

- [ ] **Step 6: Write sandbox test**

```typescript
// tests/engine/tools/sandbox.test.ts
import { describe, it, expect } from 'vitest';
import { sandboxTool } from '../../../src/engine/tools/sandbox.js';

describe('Sandbox Tool', () => {
  it('should execute simple arithmetic', async () => {
    const result = await sandboxTool.execute({ code: '1 + 1' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('2');
  });

  it('should capture log output', async () => {
    const result = await sandboxTool.execute({ code: 'log("hello"); 42' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('should return error for invalid code', async () => {
    const result = await sandboxTool.execute({ code: 'throw new Error("test")' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should timeout on infinite loop', async () => {
    const result = await sandboxTool.execute({ code: 'while(true){}', timeout: 1000 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 7: Write filesystem test**

```typescript
// tests/engine/tools/filesystem.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { filesystemTool, setWorkingDirectory } from '../../../src/engine/tools/filesystem.js';

describe('Filesystem Tool', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reasonloop-test-'));
    await fs.writeFile(path.join(tmpDir, 'test.txt'), 'Hello, World!');
    setWorkingDirectory(tmpDir);
  });

  it('should read a file in working directory', async () => {
    const result = await filesystemTool.execute({ path: 'test.txt' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello, World!');
  });

  it('should fail for non-existent file', async () => {
    const result = await filesystemTool.execute({ path: 'nonexistent.txt' });
    expect(result.success).toBe(false);
  });

  it('should reject path traversal attempts', async () => {
    const result = await filesystemTool.execute({ path: '../../../etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('escapes');
  });
});
```

- [ ] **Step 8: Run all tool tests**

```bash
npx vitest run tests/engine/tools/
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/engine/tools/ tests/engine/tools/
git commit -m "feat: add tool grounding layer with registry, sandbox, HTTP, and filesystem tools"
```

---

### Task 13: JSON State Storage

**Files:**
- Create: `src/engine/storage.ts`
- Create: `tests/engine/storage.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/engine/storage.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { saveState, loadState, loadHistory } from '../../src/engine/storage.js';
import { initState } from '../../src/core/state.js';
import type { State } from '../../src/core/types.js';

describe('Storage Module', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reasonloop-storage-'));
  });

  it('should save and load a state', async () => {
    const state = initState('test problem');
    await saveState(state, tmpDir);
    const loaded = await loadState(tmpDir, 0);
    expect(loaded).toEqual(state);
  });

  it('should load full history', async () => {
    const state0 = initState('test');
    const state1 = { ...state0, iteration: 1 };
    await saveState(state0, tmpDir);
    await saveState(state1, tmpDir);
    const history = await loadHistory(tmpDir);
    expect(history).toHaveLength(2);
    expect(history[0].iteration).toBe(0);
    expect(history[1].iteration).toBe(1);
  });

  it('should return empty history for non-existent directory', async () => {
    const history = await loadHistory('/nonexistent/path');
    expect(history).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/storage.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/engine/storage.ts**

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import type { State } from '../core/types.js';

export async function saveState(state: State, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `state-${String(state.iteration).padStart(4, '0')}.json`);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function loadState(outputDir: string, iteration: number): Promise<State> {
  const filePath = path.join(outputDir, `state-${String(iteration).padStart(4, '0')}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as State;
}

export async function loadHistory(outputDir: string): Promise<State[]> {
  try {
    const files = await fs.readdir(outputDir);
    const stateFiles = files
      .filter(f => f.startsWith('state-') && f.endsWith('.json'))
      .sort();

    const states: State[] = [];
    for (const file of stateFiles) {
      const content = await fs.readFile(path.join(outputDir, file), 'utf-8');
      states.push(JSON.parse(content) as State);
    }
    return states;
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/engine/storage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/storage.ts tests/engine/storage.test.ts
git commit -m "feat: add JSON state persistence with save, load, and history"
```

---

### Task 14: Engine Loop

**Files:**
- Create: `src/engine/loop.ts`
- Create: `tests/engine/loop.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/engine/loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runLoop } from '../../src/engine/loop.js';
import type { LLMProvider, LLMResponse } from '../../src/engine/provider.js';
import type { RunConfig } from '../../src/core/types.js';

// Mock provider that returns structured scratchpad-style responses
function createMockProvider(responses: string[]): LLMProvider {
  let callIndex = 0;
  return {
    name: 'mock',
    complete: vi.fn(async (): Promise<LLMResponse> => {
      const content = responses[callIndex % responses.length] ?? '';
      callIndex++;
      return {
        content,
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      };
    }),
  };
}

describe('Engine Loop', () => {
  it('should run a complete loop and converge', async () => {
    const mockProvider = createMockProvider([
      `CLAIM: Test claim 1
ASSUMPTION: Test assumption 1
QUESTION: What next?`,
      `ISSUE: No evidence for claim
SUGGESTION: Add evidence`,
      `CLAIM: Test claim 1
ASSUMPTION: Test assumption 1
EVIDENCE: Supporting data found`,
    ]);

    const config: RunConfig = {
      provider: 'openai',
      model: 'test',
      maxIterations: 3,
      budget: 100000,
      stabilityThreshold: 0.85,
      minIterations: 2,
      activeViews: [],
      toolEnabled: false,
      outputDir: '/tmp/reasonloop-test',
      trace: false,
      json: false,
    };

    const result = await runLoop('Test problem', config, mockProvider);
    expect(result.finalState.iteration).toBeGreaterThanOrEqual(2);
    expect(result.history.length).toBeGreaterThanOrEqual(2);
  });

  it('should stop at max iterations', async () => {
    const mockProvider = createMockProvider([
      `CLAIM: New claim each time
QUESTION: Still uncertain?`,
    ]);

    const config: RunConfig = {
      provider: 'openai',
      model: 'test',
      maxIterations: 2,
      budget: 1000000,
      stabilityThreshold: 0.99,
      minIterations: 1,
      activeViews: [],
      toolEnabled: false,
      outputDir: '/tmp/reasonloop-test',
      trace: false,
      json: false,
    };

    const result = await runLoop('Test problem', config, mockProvider);
    expect(result.finalState.iteration).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/loop.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/engine/loop.ts**

```typescript
import type { State, RunConfig, RunResult, TransitionInput } from '../core/types.js';
import type { LLMProvider } from './provider.js';
import { initState } from '../core/state.js';
import { buildScratchpadPrompt, extractStateFragment } from '../core/scratchpad.js';
import { buildCriticPrompt, parseCriticOutput } from '../core/critic.js';
import { buildAdversaryPrompt, parseAdversaryOutput } from '../core/adversary.js';
import { decide } from '../core/policy.js';
import { transition } from '../core/transition.js';
import { checkConvergence } from '../core/convergence.js';
import { buildViewPrompt, fuseViews } from '../core/multi-view.js';
import { saveState } from './storage.js';
import { ToolRegistry } from './tools/registry.js';
import { sandboxTool } from './tools/sandbox.js';
import { httpTool } from './tools/http.js';
import { filesystemTool } from './tools/filesystem.js';

export async function runLoop(
  input: string,
  config: RunConfig,
  provider: LLMProvider,
): Promise<RunResult> {
  let state = initState(input, config.budget);
  const history: State[] = [state];

  const toolRegistry = new ToolRegistry();
  if (config.toolEnabled) {
    toolRegistry.register(sandboxTool);
    toolRegistry.register(httpTool);
    toolRegistry.register(filesystemTool);
  }

  const convergenceConfig = {
    maxIterations: config.maxIterations,
    budgetLimit: config.budget,
    stabilityThreshold: config.stabilityThreshold,
    minIterations: config.minIterations,
  };

  while (true) {
    // 1. Policy decision
    const decision = decide(state, convergenceConfig);
    if (decision.nextAction === 'stop') break;

    // 2. Multi-View reasoning
    const viewResults = [];
    if (decision.activeViews.length > 0) {
      for (const viewName of decision.activeViews) {
        const viewPrompt = buildViewPrompt(viewName as any, state);
        const viewResponse = await provider.complete(viewPrompt, {
          model: config.model,
          systemPrompt: `You are a reasoning assistant analyzing from the ${viewName} perspective.`,
        });
        const viewFragment = extractStateFragment(viewResponse.content, state.iteration + 1);
        const viewState: State = {
          ...state,
          iteration: state.iteration + 1,
          claims: viewFragment.claims.map((c, i) => ({ ...c, id: `view-${viewName}-${i}` })),
          assumptions: viewFragment.assumptions.map((a, i) => ({ ...a, id: `view-${viewName}-${i}` })),
          evidence: viewFragment.evidence.map((e, i) => ({ ...e, id: `view-${viewName}-${i}` })),
          openQuestions: viewFragment.openQuestions,
        };
        viewResults.push({ viewName, state: viewState, confidence: 0.7 });
        state.metadata.budgetRemaining -= viewResponse.usage.totalTokens;
        state.metadata.totalTokensUsed += viewResponse.usage.totalTokens;
      }
    }

    // 3. Scratchpad generation
    const scratchpadPrompt = buildScratchpadPrompt(state, decision.nextAction);
    const scratchpadResponse = await provider.complete(scratchpadPrompt, {
      model: config.model,
      systemPrompt: 'You are a reasoning assistant. Think step by step and use CLAIM/ASSUMPTION/EVIDENCE/QUESTION prefixes.',
    });
    const scratchpad = scratchpadResponse.content;
    state.metadata.budgetRemaining -= scratchpadResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += scratchpadResponse.usage.totalTokens;

    // 4. Structured extraction
    const stateFragment = extractStateFragment(scratchpad, state.iteration + 1);

    // 5. Critic evaluation
    const criticPrompt = buildCriticPrompt(state);
    const criticResponse = await provider.complete(criticPrompt, {
      model: config.model,
      systemPrompt: 'You are a critical reasoning evaluator. Find issues, risks, contradictions, and suggest improvements.',
    });
    const criticOutput = parseCriticOutput(criticResponse.content);
    state.metadata.budgetRemaining -= criticResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += criticResponse.usage.totalTokens;

    // 6. Adversary attack
    let adversaryOutput = null;
    if (decision.nextAction === 'adversary') {
      const adversaryPrompt = buildAdversaryPrompt(state);
      const adversaryResponse = await provider.complete(adversaryPrompt, {
        model: config.model,
        systemPrompt: 'You are an adversary. Attack and undermine the reasoning. Find counter-examples and edge cases.',
      });
      adversaryOutput = parseAdversaryOutput(adversaryResponse.content);
      state.metadata.budgetRemaining -= adversaryResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += adversaryResponse.usage.totalTokens;
    }

    // 7. Tool execution
    let toolResults = [];
    if (decision.toolEnabled && config.toolEnabled) {
      // For MVP, execute tools based on unverified assumptions
      // In production, LLM would generate tool call params
      // Here we skip actual execution in the loop; tools are available via registry
    }

    // 8. State Transition
    const transitionInput: TransitionInput = {
      scratchpad,
      stateFragment,
      critic: criticOutput,
      adversary: adversaryOutput,
      toolResults,
      viewResults,
    };
    state = transition(state, transitionInput, decision.nextAction);

    // 9. Fuse views if any
    if (viewResults.length > 0) {
      state = fuseViews(viewResults, state);
    }

    // 10. Persistence
    history.push(state);
    try {
      await saveState(state, config.outputDir);
    } catch {
      // Storage failure should not stop the loop
    }

    // 11. Convergence check
    if (checkConvergence(state, convergenceConfig)) break;
  }

  return { finalState: state, history };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/engine/loop.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/loop.ts tests/engine/loop.test.ts
git commit -m "feat: add reasoning loop engine with full orchestration"
```

---

### Task 15: CLI Run Command & Output Formatting

**Files:**
- Create: `src/cli/output.ts`
- Create: `src/cli/commands/run.ts`
- Create: `src/cli/index.ts`
- Create: `tests/cli/run.test.ts`

- [ ] **Step 1: Write src/cli/output.ts**

```typescript
import chalk from 'chalk';
import type { State, PolicyDecision, CriticOutput, RunResult } from '../../core/types.js';
import { diffStates } from '../../core/state.js';

export function formatIterationTerminal(
  state: State,
  decision: PolicyDecision,
  critic: CriticOutput | null,
  maxIterations: number,
): string {
  const lines: string[] = [];

  const actionColors: Record<string, typeof chalk.yellow> = {
    expand: chalk.green,
    refine: chalk.blue,
    verify: chalk.magenta,
    adversary: chalk.red,
    stop: chalk.gray,
  };
  const colorFn = actionColors[state.metadata.lastAction] ?? chalk.white;

  lines.push(
    `[Iter ${state.iteration}/${maxIterations}] ${colorFn(state.metadata.lastAction)} | stability: ${state.metadata.stability.toFixed(2)} | budget: ${state.metadata.budgetRemaining}/${state.metadata.budgetRemaining + state.metadata.totalTokensUsed}`,
  );
  lines.push(`  Claims: ${state.claims.length} | Assumptions: ${state.assumptions.length} | Open Questions: ${state.openQuestions.length}`);

  if (critic) {
    lines.push(`  Critic: ${critic.issues.length} issues, ${critic.contradictions.length} contradictions`);
  }

  lines.push('  ─────────────────────────────────────');

  if (state.claims.length > 0) {
    const topClaim = state.claims.reduce((a, b) => a.confidence > b.confidence ? a : b);
    lines.push(`  Key claim: "${topClaim.content.slice(0, 80)}${topClaim.content.length > 80 ? '...' : ''}"`);
    lines.push(`  Confidence: ${topClaim.confidence.toFixed(2)}`);
  }

  return lines.join('\n');
}

export function formatIterationJSON(
  state: State,
  decision: PolicyDecision,
  critic: CriticOutput | null,
): object {
  return {
    iteration: state.iteration,
    action: state.metadata.lastAction,
    state: {
      claims: state.claims.length,
      assumptions: state.assumptions.length,
      openQuestions: state.openQuestions.length,
      stability: state.metadata.stability,
    },
    critic: critic ? {
      issues: critic.issues.length,
      risks: critic.risks.length,
      contradictions: critic.contradictions.length,
    } : null,
    usage: {
      tokens: state.metadata.totalTokensUsed,
      budgetRemaining: state.metadata.budgetRemaining,
    },
  };
}

export function formatResultTerminal(result: RunResult): string {
  const lines: string[] = [];
  const { finalState } = result;

  lines.push('');
  lines.push(chalk.bold('═══ Reasoning Complete ═══'));
  lines.push(`Iterations: ${finalState.iteration}`);
  lines.push(`Final stability: ${finalState.metadata.stability.toFixed(2)}`);
  lines.push(`Total tokens: ${finalState.metadata.totalTokensUsed}`);
  lines.push('');
  lines.push(chalk.bold('Claims:'));

  for (const claim of finalState.claims) {
    const confColor = claim.confidence >= 0.8 ? chalk.green : claim.confidence >= 0.5 ? chalk.yellow : chalk.red;
    lines.push(`  ${confColor(`[${claim.confidence.toFixed(2)}]`)} ${claim.content}`);
  }

  if (finalState.openQuestions.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Remaining Questions:'));
    for (const q of finalState.openQuestions) {
      lines.push(`  - ${q}`);
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 2: Write src/cli/commands/run.ts**

```typescript
import type { Command } from 'commander';
import { createProvider } from '../../engine/provider.js';
import { runLoop } from '../../engine/loop.js';
import { formatIterationTerminal, formatResultTerminal, formatIterationJSON } from '../output.js';
import type { RunConfig } from '../../core/types.js';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a reasoning loop on a problem')
    .argument('<problem>', 'The problem to reason about')
    .option('-p, --provider <provider>', 'LLM provider (openai or claude)', 'openai')
    .option('-m, --model <model>', 'Model name', 'gpt-4')
    .option('--max-iterations <n>', 'Maximum iterations', '10')
    .option('--budget <n>', 'Token budget', '100000')
    .option('--stability-threshold <n>', 'Stability threshold for convergence', '0.85')
    .option('--min-iterations <n>', 'Minimum iterations before convergence', '2')
    .option('--views <views>', 'Comma-separated active views', '')
    .option('--no-tools', 'Disable tool grounding')
    .option('--trace', 'Enable trace/debug output')
    .option('--json', 'Output in JSON format')
    .option('-o, --output-dir <dir>', 'Output directory for state files', './reasonloop-output')
    .action(async (problem: string, options: Record<string, unknown>) => {
      const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) {
        console.error('Error: No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
        process.exit(1);
      }

      const providerType = options.provider as 'openai' | 'claude';
      const provider = createProvider(providerType, { apiKey });

      const config: RunConfig = {
        provider: providerType,
        model: options.model as string,
        maxIterations: Number(options.maxIterations),
        budget: Number(options.budget),
        stabilityThreshold: Number(options.stabilityThreshold),
        minIterations: Number(options.minIterations),
        activeViews: (options.views as string).split(',').filter(Boolean) as any[],
        toolEnabled: options.tools !== false,
        outputDir: options.outputDir as string,
        trace: options.trace as boolean,
        json: options.json as boolean,
      };

      try {
        const result = await runLoop(problem, config, provider);

        if (config.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatResultTerminal(result));
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
```

- [ ] **Step 3: Write src/cli/index.ts**

```typescript
import { Command } from 'commander';
import { registerRunCommand } from './commands/run.js';
import { registerReplCommand } from './commands/repl.js';

export function runCLI(): void {
  const program = new Command();

  program
    .name('reasonloop')
    .description('A controlled reasoning runtime for LLMs')
    .version('0.1.0');

  registerRunCommand(program);
  registerReplCommand(program);

  program.parse();
}
```

- [ ] **Step 4: Write a basic test for CLI**

```typescript
// tests/cli/run.test.ts
import { describe, it, expect } from 'vitest';
import { formatIterationTerminal, formatResultTerminal, formatIterationJSON } from '../../src/cli/output.js';
import { initState } from '../../src/core/state.js';
import type { RunResult, PolicyDecision, CriticOutput } from '../../src/core/types.js';

describe('CLI Output', () => {
  describe('formatIterationTerminal', () => {
    it('should format iteration for terminal display', () => {
      const state = initState('test');
      const decision: PolicyDecision = {
        nextAction: 'expand',
        activeViews: [],
        toolEnabled: false,
        reasoning: 'test',
      };
      const output = formatIterationTerminal(state, decision, null, 10);
      expect(output).toContain('Iter');
      expect(output).toContain('expand');
    });
  });

  describe('formatResultTerminal', () => {
    it('should format final result', () => {
      const state = initState('test');
      const result: RunResult = { finalState: state, history: [state] };
      const output = formatResultTerminal(result);
      expect(output).toContain('Reasoning Complete');
    });
  });

  describe('formatIterationJSON', () => {
    it('should format iteration as JSON object', () => {
      const state = initState('test');
      const decision: PolicyDecision = {
        nextAction: 'expand',
        activeViews: [],
        toolEnabled: false,
        reasoning: 'test',
      };
      const json = formatIterationJSON(state, decision, null);
      expect(json).toHaveProperty('iteration');
      expect(json).toHaveProperty('action');
    });
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/cli/run.test.ts
```

Expected: PASS (note: will fail until REPL command is registered — see Task 16)

- [ ] **Step 6: Commit**

```bash
git add src/cli/ tests/cli/
git commit -m "feat: add CLI run command and output formatting"
```

---

### Task 16: CLI REPL

**Files:**
- Create: `src/cli/commands/repl.ts`
- Create: `tests/cli/repl.test.ts`

- [ ] **Step 1: Write src/cli/commands/repl.ts**

```typescript
import * as readline from 'node:readline';
import type { Command } from 'commander';
import chalk from 'chalk';
import { createProvider } from '../../engine/provider.js';
import type { LLMProvider } from '../../engine/provider.js';
import type { State, RunConfig } from '../../core/types.js';
import { initState, diffStates } from '../../core/state.js';
import { runLoop } from '../../engine/loop.js';
import { formatResultTerminal } from '../output.js';

export function registerReplCommand(program: Command): void {
  program
    .command('repl')
    .description('Start interactive reasoning session')
    .option('-p, --provider <provider>', 'LLM provider', 'openai')
    .option('-m, --model <model>', 'Model name', 'gpt-4')
    .action(async (options: Record<string, unknown>) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('reasonloop> '),
      });

      let currentState: State | null = null;
      let problem: string | null = null;
      let provider: LLMProvider | null = null;
      let providerType = options.provider as 'openai' | 'claude';
      let modelName = options.model as string;
      const history: State[] = [];

      function getProvider(): LLMProvider {
        if (!provider) {
          const apiKey = providerType === 'openai'
            ? process.env.OPENAI_API_KEY ?? ''
            : process.env.ANTHROPIC_API_KEY ?? '';
          provider = createProvider(providerType, { apiKey });
        }
        return provider;
      }

      console.log(chalk.bold('ReasonLoop REPL v0.1.0'));
      console.log('Type "help" for available commands.\n');

      rl.prompt();

      rl.on('line', async (line: string) => {
        const input = line.trim();
        if (!input) { rl.prompt(); return; }

        const [cmd, ...args] = input.split(/\s+/);

        try {
          switch (cmd) {
            case 'load':
              problem = args.join(' ');
              currentState = initState(problem);
              history.length = 0;
              history.push(currentState);
              console.log(chalk.green(`Problem loaded: "${problem}"`));
              break;

            case 'step':
              if (!problem || !currentState) {
                console.log(chalk.yellow('No problem loaded. Use: load "your problem"'));
                break;
              }
              // Run one iteration
              const stepConfig: RunConfig = {
                provider: providerType,
                model: modelName,
                maxIterations: currentState.iteration + 1,
                budget: 100000,
                stabilityThreshold: 0.99, // prevent early convergence in step mode
                minIterations: 1,
                activeViews: [],
                toolEnabled: true,
                outputDir: '/tmp/reasonloop-repl',
                trace: false,
                json: false,
              };
              const stepResult = await runLoop(problem, stepConfig, getProvider());
              currentState = stepResult.finalState;
              history.push(currentState);
              console.log(`Iteration ${currentState.iteration} complete. Stability: ${currentState.metadata.stability.toFixed(2)}`);
              break;

            case 'run':
              if (!problem || !currentState) {
                console.log(chalk.yellow('No problem loaded. Use: load "your problem"'));
                break;
              }
              const runConfig: RunConfig = {
                provider: providerType,
                model: modelName,
                maxIterations: 10,
                budget: 100000,
                stabilityThreshold: 0.85,
                minIterations: 2,
                activeViews: [],
                toolEnabled: true,
                outputDir: '/tmp/reasonloop-repl',
                trace: false,
                json: false,
              };
              const runResult = await runLoop(problem, runConfig, getProvider());
              currentState = runResult.finalState;
              console.log(formatResultTerminal(runResult));
              break;

            case 'state':
              if (!currentState) {
                console.log(chalk.yellow('No state available.'));
                break;
              }
              if (args[0] === 'diff' && history.length >= 2) {
                const diff = diffStates(currentState, history[history.length - 2]);
                console.log(JSON.stringify(diff, null, 2));
              } else {
                console.log(JSON.stringify(currentState, null, 2));
              }
              break;

            case 'budget':
              if (currentState) {
                console.log(`Remaining: ${currentState.metadata.budgetRemaining} tokens`);
                console.log(`Used: ${currentState.metadata.totalTokensUsed} tokens`);
              }
              break;

            case 'set':
              if (args[0] === 'provider' && args[1]) {
                providerType = args[1] as 'openai' | 'claude';
                provider = null; // reset provider
                console.log(`Provider set to ${providerType}`);
              } else if (args[0] === 'views' && args[1]) {
                console.log(`Views: ${args[1]}`);
              }
              break;

            case 'history':
              console.log(`Iterations: ${history.length}`);
              for (const s of history) {
                console.log(`  [${s.iteration}] stability=${s.metadata.stability.toFixed(2)} claims=${s.claims.length}`);
              }
              break;

            case 'export':
              if (currentState) {
                console.log(JSON.stringify({ finalState: currentState, history }, null, 2));
              }
              break;

            case 'help':
              console.log(`
Available commands:
  load "<problem>"    Set the problem to reason about
  step                Execute one iteration
  run                 Run to convergence
  state               View current state
  state diff          View diff from previous step
  budget              View remaining budget
  set provider <name> Switch LLM provider (openai/claude)
  set views <list>    Set active views (comma-separated)
  history             View iteration history
  export              Export full run results as JSON
  help                Show this help
  quit                Exit REPL
              `);
              break;

            case 'quit':
            case 'exit':
              console.log(chalk.gray('Goodbye.'));
              rl.close();
              return;

            default:
              console.log(chalk.yellow(`Unknown command: ${cmd}. Type "help" for available commands.`));
          }
        } catch (err) {
          console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
        }

        rl.prompt();
      });

      rl.on('close', () => {
        process.exit(0);
      });
    });
}
```

- [ ] **Step 2: Write a basic REPL test**

```typescript
// tests/cli/repl.test.ts
import { describe, it, expect } from 'vitest';
// REPL is interactive, so we test the command registration only
import { Command } from 'commander';
import { registerReplCommand } from '../../src/cli/commands/repl.js';

describe('REPL Command', () => {
  it('should register repl command without error', () => {
    const program = new Command();
    registerReplCommand(program);
    const replCmd = program.commands.find(c => c.name() === 'repl');
    expect(replCmd).toBeDefined();
  });
});
```

- [ ] **Step 3: Run all CLI tests**

```bash
npx vitest run tests/cli/
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/repl.ts tests/cli/repl.test.ts
git commit -m "feat: add interactive REPL with step/run/state/budget commands"
```

---

### Task 17: Library Entry Point & Final Integration

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update src/index.ts to export all public APIs**

```typescript
// ReasonLoop Kernel - Library Entry

// Core types
export type {
  Claim,
  Assumption,
  Evidence,
  Controversy,
  State,
  StateMetadata,
  CriticOutput,
  PolicyAction,
  PolicyDecision,
  ViewType,
  ViewResult,
  ToolResult,
  ConvergenceConfig,
  RunConfig,
  RunResult,
  TransitionInput,
} from './core/types.js';

// Core functions
export { initState, addClaim, addAssumption, addEvidence, computeStability, diffStates } from './core/state.js';
export { buildScratchpadPrompt, extractStateFragment } from './core/scratchpad.js';
export { buildCriticPrompt, parseCriticOutput } from './core/critic.js';
export { buildAdversaryPrompt, parseAdversaryOutput } from './core/adversary.js';
export { decide } from './core/policy.js';
export { transition } from './core/transition.js';
export { checkConvergence } from './core/convergence.js';
export { buildViewPrompt, fuseViews } from './core/multi-view.js';

// Engine
export { createProvider } from './engine/provider.js';
export type { LLMProvider, LLMOptions, LLMResponse, ProviderConfig } from './engine/provider.js';
export { runLoop } from './engine/loop.js';
export { ToolRegistry } from './engine/tools/registry.js';
export { saveState, loadState, loadHistory } from './engine/storage.js';
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 3: Build the project**

```bash
npm run build
```

Expected: No TypeScript errors

- [ ] **Step 4: Verify CLI works**

```bash
node dist/bin/reasonloop.js --help
```

Expected: Shows help with run and repl commands

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: add library entry point with full public API exports"
```

---

### Task 18: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Build production**

```bash
npm run build
```

Expected: Clean build

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration and verification"
```
