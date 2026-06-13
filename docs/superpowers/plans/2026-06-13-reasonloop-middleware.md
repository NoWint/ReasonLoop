# ReasonLoop Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reasoning middleware that sits between Agents and LLMs, providing structured, stateful, adversarially-evaluated reasoning via an OpenAI/Anthropic compatible proxy.

**Architecture:** Middleware pipeline — Gateway (HTTP Proxy) → Complexity Analyzer → Policy Controller → Reasoning Loop (Planner/Critic/Adversary) → State Transition → Prompt Compiler → Model Adapter → LLM. Low-complexity requests passthrough directly.

**Tech Stack:** TypeScript, Node.js, Fastify, OpenAI SDK, Anthropic SDK, Commander.js, Vitest

---

## File Structure

```
reasonloop/
├── src/
│   ├── gateway/
│   │   ├── server.ts             # Fastify HTTP server setup
│   │   ├── routes/
│   │   │   ├── openai.ts         # POST /v1/chat/completions
│   │   │   └── anthropic.ts      # POST /v1/messages
│   │   ├── middleware.ts         # Logging, error handling, request ID
│   │   └── types.ts              # Proxy request/response types
│   ├── core/
│   │   ├── types.ts              # All core type definitions
│   │   ├── state.ts              # State creation, mutation, diff, stability
│   │   ├── scratchpad.ts         # Scratchpad generation prompt & extraction
│   │   ├── planner.ts            # Planner expansion prompt & extraction
│   │   ├── critic.ts             # Critic evaluation prompt & parsing
│   │   ├── adversary.ts          # Adversary attack prompt & parsing
│   │   ├── validator.ts          # Validator interface (no implementation)
│   │   ├── policy.ts             # Policy controller
│   │   ├── transition.ts         # State transition engine
│   │   ├── convergence.ts        # Convergence detection
│   │   ├── complexity.ts         # Complexity analyzer
│   │   └── compiler.ts           # Prompt compiler
│   ├── engine/
│   │   ├── loop.ts               # Reasoning loop controller
│   │   ├── adapter.ts            # Model adapter interface & factory
│   │   ├── adapters/
│   │   │   ├── openai.ts         # OpenAI adapter
│   │   │   └── claude.ts         # Claude adapter
│   │   └── storage.ts            # JSON state persistence
│   ├── cli/
│   │   ├── index.ts              # CLI entry (Commander)
│   │   ├── commands/
│   │   │   ├── start.ts          # reasonloop start
│   │   │   ├── status.ts         # reasonloop status
│   │   │   ├── sessions.ts       # reasonloop sessions
│   │   │   └── inspect.ts        # reasonloop inspect <id>
│   │   └── output.ts             # Output formatting
│   └── index.ts                  # Library entry
├── tests/
│   ├── core/
│   │   ├── types.test.ts
│   │   ├── state.test.ts
│   │   ├── scratchpad.test.ts
│   │   ├── planner.test.ts
│   │   ├── critic.test.ts
│   │   ├── adversary.test.ts
│   │   ├── policy.test.ts
│   │   ├── transition.test.ts
│   │   ├── convergence.test.ts
│   │   ├── complexity.test.ts
│   │   └── compiler.test.ts
│   ├── engine/
│   │   ├── loop.test.ts
│   │   ├── adapter.test.ts
│   │   └── storage.test.ts
│   ├── gateway/
│   │   ├── openai.test.ts
│   │   └── anthropic.test.ts
│   └── cli/
│       └── commands.test.ts
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
  "description": "A reasoning middleware that sits between agents and language models",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "reasonloop": "dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "start": "node dist/cli/index.js start"
  },
  "keywords": ["llm", "reasoning", "middleware", "proxy", "agent"],
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install fastify @fastify/cors openai @anthropic-ai/sdk commander chalk uuid
npm install -D typescript vitest @types/node @types/uuid tsx
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
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

- [ ] **Step 5: Create src/index.ts**

```typescript
// ReasonLoop Kernel - Library Entry
// Will be populated as modules are implemented
export {};
```

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p src/gateway/routes src/core src/engine/adapters src/cli/commands tests/core tests/engine tests/gateway tests/cli
```

- [ ] **Step 7: Verify build works**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with TypeScript, Vitest, Fastify, Commander"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`
- Create: `tests/core/types.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/core/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Claim,
  Assumption,
  Evidence,
  Controversy,
  ReasoningState,
  CriticOutput,
  Decision,
  PolicyDecision,
  ComplexityAnalysis,
  CompiledPrompt,
  ValidationResult,
  Validator,
  ConvergenceConfig,
} from '../../src/core/types.js';

describe('Core Types', () => {
  it('should construct a valid ReasoningState', () => {
    const state: ReasoningState = {
      id: 'test-1',
      goal: 'Design a system',
      iteration: 0,
      claims: [],
      assumptions: [],
      evidence: [],
      openQuestions: ['Design a system'],
      controversies: [],
      metadata: {
        stability: 0,
        complexity: 0.8,
        lastAction: 'init',
        budgetRemaining: 100000,
        totalTokensUsed: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    expect(state.metadata.complexity).toBe(0.8);
    expect(state.openQuestions).toHaveLength(1);
  });

  it('should construct a valid PolicyDecision with marginal analysis', () => {
    const decision: PolicyDecision = {
      nextAction: 'expand',
      reasoning: 'Initial exploration',
      estimatedGain: 0.8,
      estimatedCost: 0.2,
    };
    expect(decision.estimatedGain).toBeGreaterThan(decision.estimatedCost);
  });

  it('should construct a valid ComplexityAnalysis', () => {
    const analysis: ComplexityAnalysis = {
      score: 0.7,
      shouldLoop: true,
      reasoning: 'Complex design task',
    };
    expect(analysis.shouldLoop).toBe(true);
  });

  it('should construct a valid CompiledPrompt', () => {
    const prompt: CompiledPrompt = {
      system: 'You are a planner',
      user: '## Goal\nDesign a system',
      context: 'Reasoning completed in 3 iterations',
    };
    expect(prompt.system).toBeTruthy();
  });

  it('should construct a valid ValidationResult', () => {
    const result: ValidationResult = {
      passed: true,
      evidence: 'Code executed successfully',
    };
    expect(result.passed).toBe(true);
  });

  it('should define a Validator interface', () => {
    const validator: Validator = {
      name: 'test-validator',
      validate: async () => ({ passed: true, evidence: 'ok' }),
    };
    expect(validator.name).toBe('test-validator');
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
// Core type definitions for ReasonLoop Middleware

export interface Claim {
  id: string;
  content: string;
  confidence: number;             // 0-1
  source: 'planner' | 'critic' | 'adversary' | 'validator';
  evidence: string[];             // Linked evidence IDs
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
  type: 'logical' | 'empirical' | 'validator_result' | 'retrieved';
  source: string;
  reliable: boolean;
  iteration: number;
}

export interface Controversy {
  id: string;
  description: string;
  positions: string[];            // Claim IDs
  resolved: boolean;
  resolution?: string;
}

export interface StateMetadata {
  stability: number;
  complexity: number;
  lastAction: string;
  budgetRemaining: number;
  totalTokensUsed: number;
  createdAt: number;
  updatedAt: number;
}

export interface ReasoningState {
  id: string;
  goal: string;
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

export type Decision = 'expand' | 'refine' | 'verify' | 'attack' | 'stop';

export interface PolicyDecision {
  nextAction: Decision;
  reasoning: string;
  estimatedGain: number;
  estimatedCost: number;
}

export interface ComplexityAnalysis {
  score: number;                  // 0-1
  shouldLoop: boolean;
  reasoning: string;
}

export interface CompiledPrompt {
  system: string;
  user: string;
  context: string;
}

export interface ValidationResult {
  passed: boolean;
  evidence: string;
  details?: string;
}

export interface Validator {
  name: string;
  validate(state: ReasoningState): Promise<ValidationResult>;
}

export interface ConvergenceConfig {
  maxIterations: number;
  budgetLimit: number;
  stabilityThreshold: number;
  minIterations: number;
  complexityThreshold: number;
}

export interface TransitionInput {
  scratchpad: string;
  stateFragment: Partial<ReasoningState>;
  critic: CriticOutput;
  adversary: CriticOutput | null;
  validatorResults: ValidationResult[];
}

// Gateway types
export interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ProxyResponse {
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

export interface ServerConfig {
  port: number;
  provider: 'openai' | 'claude';
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxIterations: number;
  budget: number;
  stabilityThreshold: number;
  minIterations: number;
  complexityThreshold: number;
  outputDir: string;
  loopTimeoutMs: number;
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
git commit -m "feat: add core type definitions for middleware architecture"
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
import { initState, addClaim, addAssumption, addEvidence, computeStability, diffStates } from '../../src/core/state.js';
import type { Claim, Assumption, Evidence } from '../../src/core/types.js';

describe('State Module', () => {
  describe('initState', () => {
    it('should create initial state with goal as open question', () => {
      const state = initState('Design a microservices system', 'session-1');
      expect(state.id).toBe('session-1');
      expect(state.goal).toBe('Design a microservices system');
      expect(state.openQuestions).toEqual(['Design a microservices system']);
      expect(state.iteration).toBe(0);
      expect(state.metadata.stability).toBe(0);
      expect(state.metadata.budgetRemaining).toBeGreaterThan(0);
    });
  });

  describe('addClaim', () => {
    it('should add a claim with generated id', () => {
      const state = initState('test', 's1');
      const claim: Omit<Claim, 'id'> = {
        content: 'Test claim',
        confidence: 0.8,
        source: 'planner',
        evidence: [],
        iteration: 1,
      };
      const newState = addClaim(state, claim);
      expect(newState.claims).toHaveLength(1);
      expect(newState.claims[0].id).toMatch(/^claim-/);
    });

    it('should not mutate original state', () => {
      const state = initState('test', 's1');
      addClaim(state, { content: 'Test', confidence: 0.5, source: 'planner', evidence: [], iteration: 1 });
      expect(state.claims).toHaveLength(0);
    });
  });

  describe('addAssumption', () => {
    it('should add an assumption', () => {
      const state = initState('test', 's1');
      const assumption: Omit<Assumption, 'id'> = {
        content: 'Team has experience',
        status: 'unverified',
        challengedBy: [],
        iteration: 1,
      };
      const newState = addAssumption(state, assumption);
      expect(newState.assumptions).toHaveLength(1);
    });
  });

  describe('addEvidence', () => {
    it('should add evidence', () => {
      const state = initState('test', 's1');
      const evidence: Omit<Evidence, 'id'> = {
        content: 'Survey data',
        type: 'empirical',
        source: 'planner',
        reliable: true,
        iteration: 1,
      };
      const newState = addEvidence(state, evidence);
      expect(newState.evidence).toHaveLength(1);
    });
  });

  describe('computeStability', () => {
    it('should return 1 for identical states', () => {
      const state = initState('test', 's1');
      expect(computeStability(state, state)).toBe(1);
    });

    it('should return lower stability when claims change', () => {
      const prev = initState('test', 's1');
      let curr = initState('test', 's1');
      curr = addClaim(curr, { content: 'New claim 1', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 });
      curr = addClaim(curr, { content: 'New claim 2', confidence: 0.7, source: 'planner', evidence: [], iteration: 1 });
      expect(computeStability(curr, prev)).toBeLessThan(1);
    });
  });

  describe('diffStates', () => {
    it('should report added and removed claims', () => {
      let prev = initState('test', 's1');
      prev = addClaim(prev, { content: 'Old claim', confidence: 0.5, source: 'planner', evidence: [], iteration: 0 });
      let curr = initState('test', 's1');
      curr = addClaim(curr, { content: 'New claim', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 });
      const diff = diffStates(curr, prev);
      expect(diff.claimsAdded).toBe(1);
      expect(diff.claimsRemoved).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/core/state.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/state.ts**

```typescript
import type { Claim, Assumption, Evidence, ReasoningState, StateMetadata } from './types.js';
import { v4 as uuidv4 } from 'uuid';

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function initState(goal: string, sessionId: string, budget: number = 100000, complexity: number = 0): ReasoningState {
  return {
    id: sessionId,
    goal,
    iteration: 0,
    claims: [],
    assumptions: [],
    evidence: [],
    openQuestions: [goal],
    controversies: [],
    metadata: {
      stability: 0,
      complexity,
      lastAction: 'init',
      budgetRemaining: budget,
      totalTokensUsed: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

export function addClaim(state: ReasoningState, claim: Omit<Claim, 'id'>): ReasoningState {
  const newClaim: Claim = { ...claim, id: generateId('claim') };
  return { ...state, claims: [...state.claims, newClaim], metadata: { ...state.metadata, updatedAt: Date.now() } };
}

export function addAssumption(state: ReasoningState, assumption: Omit<Assumption, 'id'>): ReasoningState {
  const newAssumption: Assumption = { ...assumption, id: generateId('assumption') };
  return { ...state, assumptions: [...state.assumptions, newAssumption], metadata: { ...state.metadata, updatedAt: Date.now() } };
}

export function addEvidence(state: ReasoningState, evidence: Omit<Evidence, 'id'>): ReasoningState {
  const newEvidence: Evidence = { ...evidence, id: generateId('evidence') };
  return { ...state, evidence: [...state.evidence, newEvidence], metadata: { ...state.metadata, updatedAt: Date.now() } };
}

export function computeStability(current: ReasoningState, previous: ReasoningState): number {
  if (current.claims.length === 0 && previous.claims.length === 0) return 1;

  const currentContents = new Set(current.claims.map(c => c.content));
  const previousContents = new Set(previous.claims.map(c => c.content));

  const added = [...currentContents].filter(c => !previousContents.has(c)).length;
  const removed = [...previousContents].filter(c => !currentContents.has(c)).length;
  const total = Math.max(currentContents.size, previousContents.size, 1);

  const claimDelta = (added + removed) / total;

  const avgConf = (claims: Claim[]) =>
    claims.length > 0 ? claims.reduce((s, c) => s + c.confidence, 0) / claims.length : 0;
  const confidenceShift = Math.abs(avgConf(current.claims) - avgConf(previous.claims));

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

export function diffStates(current: ReasoningState, previous: ReasoningState): StateDiff {
  const currClaimContents = new Set(current.claims.map(c => c.content));
  const prevClaimContents = new Set(previous.claims.map(c => c.content));
  const currAssumptionContents = new Set(current.assumptions.map(a => a.content));
  const prevAssumptionContents = new Set(previous.assumptions.map(a => a.content));
  const currQuestions = new Set(current.openQuestions);
  const prevQuestions = new Set(previous.openQuestions);

  return {
    claimsAdded: [...currClaimContents].filter(c => !prevClaimContents.has(c)).length,
    claimsRemoved: [...prevClaimContents].filter(c => !currClaimContents.has(c)).length,
    assumptionsAdded: [...currAssumptionContents].filter(a => !prevAssumptionContents.has(a)).length,
    assumptionsRemoved: [...prevAssumptionContents].filter(a => !currAssumptionContents.has(a)).length,
    evidenceAdded: current.evidence.length - previous.evidence.length,
    openQuestionsAdded: [...currQuestions].filter(q => !prevQuestions.has(q)).length,
    openQuestionsResolved: [...prevQuestions].filter(q => !currQuestions.has(q)).length,
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

### Task 4: Scratchpad & Planner Modules

**Files:**
- Create: `src/core/scratchpad.ts`
- Create: `src/core/planner.ts`
- Create: `tests/core/scratchpad.test.ts`
- Create: `tests/core/planner.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/scratchpad.test.ts
import { describe, it, expect } from 'vitest';
import { buildScratchpadPrompt, extractStateFragment } from '../../src/core/scratchpad.js';
import { initState } from '../../src/core/state.js';

describe('Scratchpad Module', () => {
  describe('buildScratchpadPrompt', () => {
    it('should include the goal and action', () => {
      const state = initState('Design a system', 's1');
      const prompt = buildScratchpadPrompt(state, 'expand');
      expect(prompt).toContain('Design a system');
      expect(prompt).toContain('expand');
    });

    it('should include existing claims', () => {
      let state = initState('test', 's1');
      state = { ...state, claims: [{ id: 'c1', content: 'Existing claim', confidence: 0.8, source: 'planner', evidence: [], iteration: 1 }] };
      const prompt = buildScratchpadPrompt(state, 'refine');
      expect(prompt).toContain('Existing claim');
    });
  });

  describe('extractStateFragment', () => {
    it('should extract claims, assumptions, evidence, questions', () => {
      const text = `
CLAIM: Microservices are suitable
ASSUMPTION: Team has DevOps experience
EVIDENCE: 60% adoption rate
QUESTION: What is the expected traffic?
      `;
      const fragment = extractStateFragment(text, 1);
      expect(fragment.claims.length).toBeGreaterThanOrEqual(1);
      expect(fragment.assumptions.length).toBeGreaterThanOrEqual(1);
      expect(fragment.evidence.length).toBeGreaterThanOrEqual(1);
      expect(fragment.openQuestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty text', () => {
      const fragment = extractStateFragment('', 1);
      expect(fragment.claims).toHaveLength(0);
    });

    it('should assign correct iteration', () => {
      const fragment = extractStateFragment('CLAIM: Test', 3);
      expect(fragment.claims[0]?.iteration).toBe(3);
    });
  });
});
```

```typescript
// tests/core/planner.test.ts
import { describe, it, expect } from 'vitest';
import { buildPlannerPrompt } from '../../src/core/planner.js';
import { initState } from '../../src/core/state.js';

describe('Planner Module', () => {
  it('should build a planner-specific prompt', () => {
    const state = initState('Design a launcher', 's1');
    const prompt = buildPlannerPrompt(state, 'expand');
    expect(prompt.system).toContain('planner');
    expect(prompt.user).toContain('Design a launcher');
  });

  it('should include current state context', () => {
    let state = initState('test', 's1');
    state = { ...state, claims: [{ id: 'c1', content: 'Claim A', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
    const prompt = buildPlannerPrompt(state, 'refine');
    expect(prompt.user).toContain('Claim A');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/scratchpad.test.ts tests/core/planner.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/scratchpad.ts**

```typescript
import type { ReasoningState, Claim, Assumption, Evidence, Decision } from './types.js';

export function buildScratchpadPrompt(state: ReasoningState, action: Decision): string {
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
  sections.push('Think freely. Use these prefixes:');
  sections.push('- CLAIM: <factual assertion>');
  sections.push('- ASSUMPTION: <unstated premise>');
  sections.push('- EVIDENCE: <supporting data>');
  sections.push('- QUESTION: <open question>');

  return sections.join('\n');
}

interface ExtractedFragment {
  claims: Omit<Claim, 'id'>[];
  assumptions: Omit<Assumption, 'id'>[];
  evidence: Omit<Evidence, 'id'>[];
  openQuestions: string[];
}

export function extractStateFragment(text: string, iteration: number): ExtractedFragment {
  const fragment: ExtractedFragment = { claims: [], assumptions: [], evidence: [], openQuestions: [] };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const claimMatch = trimmed.match(/^CLAIM:\s*(.+)/i);
    if (claimMatch) { fragment.claims.push({ content: claimMatch[1].trim(), confidence: 0.5, source: 'planner', evidence: [], iteration }); continue; }
    const assumptionMatch = trimmed.match(/^ASSUMPTION:\s*(.+)/i);
    if (assumptionMatch) { fragment.assumptions.push({ content: assumptionMatch[1].trim(), status: 'unverified', challengedBy: [], iteration }); continue; }
    const evidenceMatch = trimmed.match(/^EVIDENCE:\s*(.+)/i);
    if (evidenceMatch) { fragment.evidence.push({ content: evidenceMatch[1].trim(), type: 'logical', source: 'planner', reliable: true, iteration }); continue; }
    const questionMatch = trimmed.match(/^QUESTION:\s*(.+)/i);
    if (questionMatch) { fragment.openQuestions.push(questionMatch[1].trim()); continue; }
  }

  return fragment;
}
```

- [ ] **Step 4: Write src/core/planner.ts**

```typescript
import type { ReasoningState, Decision, CompiledPrompt } from './types.js';

export function buildPlannerPrompt(state: ReasoningState, action: Decision): CompiledPrompt {
  const system = `You are a reasoning planner. Expand the analysis, propose solutions, and discover possible paths. Do NOT judge correctness — only explore.

Current task: ${action}
Iteration: ${state.iteration}
Stability: ${state.metadata.stability.toFixed(2)}

Output format:
- CLAIM: <factual assertion>
- ASSUMPTION: <unstated premise>
- EVIDENCE: <supporting data>
- QUESTION: <open question>`;

  const sections: string[] = [];
  sections.push(`## Goal\n${state.goal}`);

  if (state.claims.length > 0) {
    sections.push('## Current Claims');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content} (source: ${c.source})`));
  }
  if (state.assumptions.length > 0) {
    sections.push('## Assumptions');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
  }
  if (state.evidence.length > 0) {
    sections.push('## Evidence');
    state.evidence.forEach(e => sections.push(`- [${e.type}] ${e.content}`));
  }
  if (state.openQuestions.length > 0) {
    sections.push('## Open Questions');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
  }
  if (state.controversies.length > 0) {
    sections.push('## Controversies');
    state.controversies.forEach(c => sections.push(`- ${c.description} ${c.resolved ? '(resolved)' : '(unresolved)'}`));
  }

  const context = `Planning for iteration ${state.iteration + 1}. ${state.claims.length} claims, ${state.openQuestions.length} open questions.`;

  return { system, user: sections.join('\n\n'), context };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/core/scratchpad.test.ts tests/core/planner.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/scratchpad.ts src/core/planner.ts tests/core/scratchpad.test.ts tests/core/planner.test.ts
git commit -m "feat: add scratchpad and planner modules"
```

---

### Task 5: Critic & Adversary Modules

**Files:**
- Create: `src/core/critic.ts`
- Create: `src/core/adversary.ts`
- Create: `tests/core/critic.test.ts`
- Create: `tests/core/adversary.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/critic.test.ts
import { describe, it, expect } from 'vitest';
import { buildCriticPrompt, parseCriticOutput } from '../../src/core/critic.js';
import { initState } from '../../src/core/state.js';

describe('Critic Module', () => {
  it('should build critic prompt with claims', () => {
    let state = initState('test', 's1');
    state = { ...state, claims: [{ id: 'c1', content: 'Claim A', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
    const prompt = buildCriticPrompt(state);
    expect(prompt).toContain('Claim A');
  });

  it('should parse critic output', () => {
    const response = `ISSUE: Overgeneralization\nRISK: Premature adoption\nCONTRADICTION: Conflicting claims\nSUGGESTION: Qualify the claim`;
    const output = parseCriticOutput(response);
    expect(output.issues).toHaveLength(1);
    expect(output.risks).toHaveLength(1);
    expect(output.contradictions).toHaveLength(1);
    expect(output.suggestions).toHaveLength(1);
  });

  it('should handle empty response', () => {
    const output = parseCriticOutput('');
    expect(output.issues).toHaveLength(0);
  });
});
```

```typescript
// tests/core/adversary.test.ts
import { describe, it, expect } from 'vitest';
import { buildAdversaryPrompt, parseAdversaryOutput } from '../../src/core/adversary.js';
import { initState } from '../../src/core/state.js';

describe('Adversary Module', () => {
  it('should build adversary prompt', () => {
    let state = initState('test', 's1');
    state = { ...state, claims: [{ id: 'c1', content: 'REST is best', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
    const prompt = buildAdversaryPrompt(state);
    expect(prompt).toContain('REST is best');
    expect(prompt).toContain('attack');
  });

  it('should parse adversary output', () => {
    const response = `ISSUE: gRPC outperforms REST\nRISK: Over-fetching\nCONTRADICTION: Context-dependent\nSUGGESTION: Narrow the claim`;
    const output = parseAdversaryOutput(response);
    expect(output.issues).toHaveLength(1);
    expect(output.suggestions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/critic.test.ts tests/core/adversary.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/critic.ts**

```typescript
import type { ReasoningState, CriticOutput } from './types.js';

export function buildCriticPrompt(state: ReasoningState): string {
  const sections: string[] = [];
  sections.push('## Critic Evaluation\n');
  sections.push('Evaluate the reasoning state for logical issues, risks, contradictions, and suggest improvements.\n');

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

  sections.push('### Output Format');
  sections.push('- ISSUE: <logical problem or gap>');
  sections.push('- RISK: <potential negative outcome>');
  sections.push('- CONTRADICTION: <conflict between claims or evidence>');
  sections.push('- SUGGESTION: <recommended improvement>');

  return sections.join('\n');
}

export function parseCriticOutput(response: string): CriticOutput {
  const output: CriticOutput = { issues: [], risks: [], contradictions: [], suggestions: [] };
  for (const line of response.split('\n')) {
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

- [ ] **Step 4: Write src/core/adversary.ts**

```typescript
import type { ReasoningState, CriticOutput } from './types.js';

export function buildAdversaryPrompt(state: ReasoningState): string {
  const sections: string[] = [];
  sections.push('## Adversary Attack\n');
  sections.push('Your role is to actively attack and undermine the reasoning. Construct counter-examples, break assumptions, find edge cases.\n');

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
  sections.push('- Construct counter-examples');
  sections.push('- Identify edge cases and extreme scenarios');
  sections.push('- Challenge assumptions with contradictory evidence');
  sections.push('');
  sections.push('### Output Format');
  sections.push('- ISSUE: <counter-example or attack>');
  sections.push('- RISK: <scenario where reasoning fails>');
  sections.push('- CONTRADICTION: <direct conflict>');
  sections.push('- SUGGESTION: <how to make the claim more robust>');

  return sections.join('\n');
}

export function parseAdversaryOutput(response: string): CriticOutput {
  const output: CriticOutput = { issues: [], risks: [], contradictions: [], suggestions: [] };
  for (const line of response.split('\n')) {
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

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/core/critic.test.ts tests/core/adversary.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/critic.ts src/core/adversary.ts tests/core/critic.test.ts tests/core/adversary.test.ts
git commit -m "feat: add critic and adversary modules"
```

---

### Task 6: Validator Interface, Policy, Transition, Convergence

**Files:**
- Create: `src/core/validator.ts`
- Create: `src/core/policy.ts`
- Create: `src/core/transition.ts`
- Create: `src/core/convergence.ts`
- Create: `tests/core/policy.test.ts`
- Create: `tests/core/transition.test.ts`
- Create: `tests/core/convergence.test.ts`

- [ ] **Step 1: Write src/core/validator.ts (interface only)**

```typescript
import type { Validator, ValidationResult, ReasoningState } from './types.js';

// No-op validator for MVP — returns passed with no evidence
export const noopValidator: Validator = {
  name: 'noop',
  async validate(_state: ReasoningState): Promise<ValidationResult> {
    return { passed: true, evidence: 'No validation performed (MVP)' };
  },
};
```

- [ ] **Step 2: Write the policy tests**

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
  complexityThreshold: 0.5,
};

describe('Policy Module', () => {
  it('should expand on first iteration', () => {
    const state = initState('test', 's1');
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('expand');
  });

  it('should stop at max iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 10 };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('stop');
  });

  it('should stop when stability exceeds threshold after min iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 3, metadata: { ...initState('test', 's1').metadata, stability: 0.9 } };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('stop');
  });

  it('should not stop before min iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 1, metadata: { ...initState('test', 's1').metadata, stability: 0.95 } };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).not.toBe('stop');
  });

  it('should trigger attack periodically', () => {
    const state = { ...initState('test', 's1'), iteration: 4, metadata: { ...initState('test', 's1').metadata, stability: 0.4 } };
    const decision = decide(state, defaultConfig);
    expect(decision.nextAction).toBe('attack');
  });

  it('should always provide reasoning and marginal estimates', () => {
    const state = initState('test', 's1');
    const decision = decide(state, defaultConfig);
    expect(decision.reasoning).toBeTruthy();
    expect(decision.estimatedGain).toBeGreaterThanOrEqual(0);
    expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 3: Write src/core/policy.ts**

```typescript
import type { ReasoningState, PolicyDecision, ConvergenceConfig } from './types.js';

function estimateGain(state: ReasoningState): number {
  const openScore = state.openQuestions.length * 0.2;
  const controversyScore = state.controversies.filter(c => !c.resolved).length * 0.15;
  const unverifiedScore = state.assumptions.filter(a => a.status === 'unverified').length * 0.1;
  return Math.min(openScore + controversyScore + unverifiedScore, 1);
}

function estimateCost(state: ReasoningState): number {
  const budgetUsedRatio = 1 - (state.metadata.budgetRemaining / 100000);
  return budgetUsedRatio * 0.5 + 0.1;
}

export function decide(state: ReasoningState, config: ConvergenceConfig): PolicyDecision {
  const { iteration, metadata, assumptions, openQuestions } = state;
  const { stability, budgetRemaining } = metadata;

  const gain = estimateGain(state);
  const cost = estimateCost(state);

  // Hard stop conditions
  if (iteration >= config.maxIterations) {
    return { nextAction: 'stop', reasoning: 'Max iterations reached', estimatedGain: gain, estimatedCost: cost };
  }
  if (iteration >= config.minIterations && stability >= config.stabilityThreshold) {
    return { nextAction: 'stop', reasoning: `Stability ${stability.toFixed(2)} >= threshold`, estimatedGain: gain, estimatedCost: cost };
  }
  if (budgetRemaining <= 0) {
    return { nextAction: 'stop', reasoning: 'Budget exhausted', estimatedGain: gain, estimatedCost: cost };
  }

  // Marginal analysis: stop if gain < cost after min iterations
  if (iteration >= config.minIterations && gain < cost) {
    return { nextAction: 'stop', reasoning: `Marginal gain (${gain.toFixed(2)}) < cost (${cost.toFixed(2)})`, estimatedGain: gain, estimatedCost: cost };
  }

  // First iteration → expand
  if (iteration === 0) {
    return { nextAction: 'expand', reasoning: 'Initial exploration', estimatedGain: gain, estimatedCost: cost };
  }

  // Periodic attack (every 3rd iteration starting from 4)
  if (iteration >= 4 && iteration % 3 === 1 && stability < config.stabilityThreshold) {
    return { nextAction: 'attack', reasoning: `Periodic adversary check at iteration ${iteration}`, estimatedGain: gain, estimatedCost: cost };
  }

  // Unverified assumptions → verify
  if (assumptions.filter(a => a.status === 'unverified').length > 0 && iteration >= 2) {
    return { nextAction: 'verify', reasoning: 'Unverified assumptions need validation', estimatedGain: gain, estimatedCost: cost };
  }

  // Low stability → expand
  if (stability < 0.4) {
    return { nextAction: 'expand', reasoning: `Low stability (${stability.toFixed(2)})`, estimatedGain: gain, estimatedCost: cost };
  }

  // Default → refine
  return { nextAction: 'refine', reasoning: `Medium stability (${stability.toFixed(2)}), refining`, estimatedGain: gain, estimatedCost: cost };
}
```

- [ ] **Step 4: Write transition tests**

```typescript
// tests/core/transition.test.ts
import { describe, it, expect } from 'vitest';
import { transition } from '../../src/core/transition.js';
import { initState } from '../../src/core/state.js';
import type { TransitionInput } from '../../src/core/types.js';

describe('Transition Module', () => {
  it('should increment iteration', () => {
    const state = initState('test', 's1');
    const input: TransitionInput = {
      scratchpad: '', stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
      critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
      adversary: null, validatorResults: [],
    };
    const newState = transition(state, input);
    expect(newState.iteration).toBe(1);
  });

  it('should merge claims and deduplicate', () => {
    const state = { ...initState('test', 's1'), claims: [{ id: 'c0', content: 'Same', confidence: 0.6, source: 'planner', evidence: [], iteration: 0 }] };
    const input: TransitionInput = {
      scratchpad: '',
      stateFragment: { claims: [{ id: 'c1', content: 'Same', confidence: 0.8, source: 'critic', evidence: [], iteration: 1 }], assumptions: [], evidence: [], openQuestions: [] },
      critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
      adversary: null, validatorResults: [],
    };
    const newState = transition(state, input);
    expect(newState.claims).toHaveLength(1);
    expect(newState.claims[0].confidence).toBe(0.8);
  });

  it('should mark assumptions as challenged when adversary finds issues', () => {
    const state = { ...initState('test', 's1'), assumptions: [{ id: 'a1', content: 'Test', status: 'unverified', challengedBy: [], iteration: 0 }] };
    const input: TransitionInput = {
      scratchpad: '', stateFragment: { claims: [], assumptions: [], evidence: [], openQuestions: [] },
      critic: { issues: [], risks: [], contradictions: [], suggestions: [] },
      adversary: { issues: ['Counter-example'], risks: [], contradictions: [], suggestions: [] },
      validatorResults: [],
    };
    const newState = transition(state, input);
    expect(newState.assumptions[0].status).toBe('challenged');
  });
});
```

- [ ] **Step 5: Write src/core/transition.ts**

```typescript
import type { ReasoningState, TransitionInput, Claim, Assumption, Evidence } from './types.js';
import { computeStability } from './state.js';

export function transition(currentState: ReasoningState, input: TransitionInput, action?: string): ReasoningState {
  const { stateFragment, adversary, validatorResults } = input;

  const mergedClaims = mergeClaims(currentState.claims, stateFragment.claims ?? []);
  const mergedAssumptions = mergeAssumptions(currentState.assumptions, stateFragment.assumptions ?? [], adversary);
  const mergedEvidence = mergeEvidence(currentState.evidence, stateFragment.evidence ?? []);

  // Add validator results as evidence
  const validatorEvidence: Evidence[] = validatorResults
    .filter(r => r.passed)
    .map(r => ({
      id: `evidence-validator-${currentState.iteration + 1}`,
      content: r.evidence,
      type: 'validator_result' as const,
      source: 'validator',
      reliable: true,
      iteration: currentState.iteration + 1,
    }));

  const existingQuestions = new Set(currentState.openQuestions);
  const newQuestions = (stateFragment.openQuestions ?? []).filter(q => !existingQuestions.has(q));

  const newState: ReasoningState = {
    ...currentState,
    iteration: currentState.iteration + 1,
    claims: mergedClaims,
    assumptions: mergedAssumptions,
    evidence: [...mergedEvidence, ...validatorEvidence],
    openQuestions: [...currentState.openQuestions, ...newQuestions],
    metadata: {
      ...currentState.metadata,
      stability: 0,
      lastAction: action ?? currentState.metadata.lastAction,
      updatedAt: Date.now(),
    },
  };

  newState.metadata.stability = computeStability(newState, currentState);
  return newState;
}

function mergeClaims(existing: Claim[], incoming: Claim[]): Claim[] {
  const result = [...existing];
  for (const claim of incoming) {
    const idx = result.findIndex(c => c.content === claim.content);
    if (idx >= 0) {
      if (claim.confidence > result[idx].confidence) result[idx] = { ...result[idx], confidence: claim.confidence };
    } else {
      result.push(claim);
    }
  }
  return result;
}

function mergeAssumptions(existing: Assumption[], incoming: Assumption[], adversary: TransitionInput['adversary']): Assumption[] {
  const result = [...existing, ...incoming];
  if (adversary && adversary.issues.length > 0) {
    for (const a of result) {
      if (a.status === 'unverified') {
        a.status = 'challenged';
        a.challengedBy = adversary.issues.slice(0, 3);
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

- [ ] **Step 6: Write convergence tests + implementation**

```typescript
// tests/core/convergence.test.ts
import { describe, it, expect } from 'vitest';
import { checkConvergence } from '../../src/core/convergence.js';
import { initState } from '../../src/core/state.js';
import type { ConvergenceConfig } from '../../src/core/types.js';

const defaultConfig: ConvergenceConfig = { maxIterations: 10, budgetLimit: 100000, stabilityThreshold: 0.85, minIterations: 2, complexityThreshold: 0.5 };

describe('Convergence Module', () => {
  it('should not converge before min iterations', () => {
    expect(checkConvergence({ ...initState('test', 's1'), iteration: 1 }, defaultConfig)).toBe(false);
  });
  it('should converge at max iterations', () => {
    expect(checkConvergence({ ...initState('test', 's1'), iteration: 10 }, defaultConfig)).toBe(true);
  });
  it('should converge when stability exceeds threshold after min iterations', () => {
    const state = { ...initState('test', 's1'), iteration: 3, metadata: { ...initState('test', 's1').metadata, stability: 0.9 } };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });
  it('should converge when budget exhausted', () => {
    const state = { ...initState('test', 's1'), iteration: 3, metadata: { ...initState('test', 's1').metadata, budgetRemaining: 0 } };
    expect(checkConvergence(state, defaultConfig)).toBe(true);
  });
});
```

```typescript
// src/core/convergence.ts
import type { ReasoningState, ConvergenceConfig } from './types.js';

export function checkConvergence(state: ReasoningState, config: ConvergenceConfig): boolean {
  if (state.iteration < config.minIterations) return false;
  if (state.iteration >= config.maxIterations) return true;
  if (state.metadata.budgetRemaining <= 0) return true;
  if (state.metadata.stability >= config.stabilityThreshold) return true;
  return false;
}
```

- [ ] **Step 7: Run all core tests**

```bash
npx vitest run tests/core/
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/validator.ts src/core/policy.ts src/core/transition.ts src/core/convergence.ts tests/core/policy.test.ts tests/core/transition.test.ts tests/core/convergence.test.ts
git commit -m "feat: add validator interface, policy, transition, and convergence modules"
```

---

### Task 7: Complexity Analyzer & Prompt Compiler

**Files:**
- Create: `src/core/complexity.ts`
- Create: `src/core/compiler.ts`
- Create: `tests/core/complexity.test.ts`
- Create: `tests/core/compiler.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// tests/core/complexity.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../../src/core/complexity.js';
import type { ProxyRequest } from '../../src/core/types.js';

describe('Complexity Analyzer', () => {
  it('should identify simple factual questions as low complexity', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'What is TCP?' }] };
    const analysis = analyzeComplexity(req);
    expect(analysis.score).toBeLessThan(0.5);
    expect(analysis.shouldLoop).toBe(false);
  });

  it('should identify design tasks as high complexity', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'Design a Minecraft launcher architecture' }] };
    const analysis = analyzeComplexity(req);
    expect(analysis.score).toBeGreaterThanOrEqual(0.5);
    expect(analysis.shouldLoop).toBe(true);
  });

  it('should identify analysis tasks as high complexity', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'Analyze the trade-offs between microservices and monolith' }] };
    const analysis = analyzeComplexity(req);
    expect(analysis.shouldLoop).toBe(true);
  });

  it('should respect custom threshold', () => {
    const req: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'How does DNS work?' }] };
    const lowThreshold = analyzeComplexity(req, 0.1);
    const highThreshold = analyzeComplexity(req, 0.9);
    expect(lowThreshold.shouldLoop || !highThreshold.shouldLoop).toBe(true);
  });
});
```

```typescript
// tests/core/compiler.test.ts
import { describe, it, expect } from 'vitest';
import { compileState, compileFinalResponse } from '../../src/core/compiler.js';
import { initState } from '../../src/core/state.js';

describe('Prompt Compiler', () => {
  describe('compileState', () => {
    it('should compile state into system/user/context prompts', () => {
      const state = initState('Design a system', 's1');
      const compiled = compileState(state, 'expand', 'planner');
      expect(compiled.system).toContain('planner');
      expect(compiled.user).toContain('Design a system');
      expect(compiled.context).toBeTruthy();
    });

    it('should include claims in user prompt', () => {
      let state = initState('test', 's1');
      state = { ...state, claims: [{ id: 'c1', content: 'Claim A', confidence: 0.9, source: 'planner', evidence: [], iteration: 1 }] };
      const compiled = compileState(state, 'refine', 'critic');
      expect(compiled.user).toContain('Claim A');
    });
  });

  describe('compileFinalResponse', () => {
    it('should compile final state into natural language', () => {
      let state = initState('Design a launcher', 's1');
      state = { ...state, claims: [{ id: 'c1', content: 'Electron is suitable', confidence: 0.85, source: 'planner', evidence: [], iteration: 1 }] };
      state = { ...state, iteration: 3, metadata: { ...state.metadata, stability: 0.87 } };
      const response = compileFinalResponse(state, [{ role: 'user', content: 'Design a launcher' }]);
      expect(response).toContain('Electron is suitable');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/complexity.test.ts tests/core/compiler.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/core/complexity.ts**

```typescript
import type { ProxyRequest, ComplexityAnalysis } from './types.js';

export function analyzeComplexity(request: ProxyRequest, threshold: number = 0.5): ComplexityAnalysis {
  const lastMessage = request.messages[request.messages.length - 1]?.content ?? '';
  const totalLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);

  let score = 0;

  // Length factor (0-0.3)
  score += Math.min(totalLength / 5000, 1) * 0.3;

  // Keyword factor (0-0.4)
  const complexKeywords = [
    '设计', '架构', '分析', '比较', '评估', '方案', '实现',
    'design', 'architect', 'analyze', 'compare', 'evaluate', 'implement', 'solution',
  ];
  if (complexKeywords.some(kw => lastMessage.toLowerCase().includes(kw))) score += 0.4;

  // Question pattern factor (0-0.3)
  if (/^(how|why|what|which|是否|如何|为什么|哪个)/i.test(lastMessage.trim())) score += 0.15;
  if (/设计|实现|方案|design|implement|solution/i.test(lastMessage)) score += 0.15;

  score = Math.min(score, 1);

  return {
    score,
    shouldLoop: score >= threshold,
    reasoning: `Complexity ${score.toFixed(2)} ${score >= threshold ? '>=' : '<'} threshold ${threshold}`,
  };
}
```

- [ ] **Step 4: Write src/core/compiler.ts**

```typescript
import type { ReasoningState, Decision, CompiledPrompt } from './types.js';

const ROLE_PROMPTS: Record<string, string> = {
  planner: 'You are a reasoning planner. Expand the analysis, propose solutions, and discover possible paths. Do NOT judge correctness — only explore.',
  critic: 'You are a critical reasoning evaluator. Find logical flaws, gaps, and inconsistencies. Use ISSUE/RISK/CONTRADICTION/SUGGESTION prefixes.',
  adversary: 'You are an adversary. Actively attack and undermine the reasoning. Construct counter-examples, break assumptions, find edge cases.',
};

export function compileState(state: ReasoningState, action: Decision, role: 'planner' | 'critic' | 'adversary'): CompiledPrompt {
  const system = `${ROLE_PROMPTS[role]}

Current task: ${action}
Iteration: ${state.iteration}
Stability: ${state.metadata.stability.toFixed(2)}

Output format:
- CLAIM: <factual assertion>
- ASSUMPTION: <unstated premise>
- EVIDENCE: <supporting data>
- QUESTION: <open question>`;

  const sections: string[] = [];
  sections.push(`## Goal\n${state.goal}`);

  if (state.claims.length > 0) {
    sections.push('## Current Claims');
    state.claims.forEach(c => sections.push(`- [${c.confidence.toFixed(2)}] ${c.content} (source: ${c.source})`));
  }
  if (state.assumptions.length > 0) {
    sections.push('## Assumptions');
    state.assumptions.forEach(a => sections.push(`- [${a.status}] ${a.content}`));
  }
  if (state.evidence.length > 0) {
    sections.push('## Evidence');
    state.evidence.forEach(e => sections.push(`- [${e.type}] ${e.content}`));
  }
  if (state.openQuestions.length > 0) {
    sections.push('## Open Questions');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
  }
  if (state.controversies.length > 0) {
    sections.push('## Controversies');
    state.controversies.forEach(c => sections.push(`- ${c.description} ${c.resolved ? '(resolved)' : '(unresolved)'}`));
  }

  const context = `Reasoning at iteration ${state.iteration}. ${state.claims.length} claims, ${state.openQuestions.length} open questions. Stability: ${state.metadata.stability.toFixed(2)}.`;

  return { system, user: sections.join('\n\n'), context };
}

export function compileFinalResponse(state: ReasoningState, _originalMessages: Array<{role: string; content: string}>): string {
  const sections: string[] = [];

  const topClaims = [...state.claims].sort((a, b) => b.confidence - a.confidence);
  if (topClaims.length > 0) {
    sections.push('### Key Findings');
    topClaims.forEach(c => sections.push(`- ${c.content} (confidence: ${c.confidence.toFixed(2)})`));
  }

  if (state.openQuestions.length > 0) {
    sections.push('### Remaining Questions');
    state.openQuestions.forEach(q => sections.push(`- ${q}`));
  }

  if (state.controversies.some(c => !c.resolved)) {
    sections.push('### Open Controversies');
    state.controversies.filter(c => !c.resolved).forEach(c => sections.push(`- ${c.description}`));
  }

  return sections.join('\n\n');
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/core/complexity.test.ts tests/core/compiler.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/complexity.ts src/core/compiler.ts tests/core/complexity.test.ts tests/core/compiler.test.ts
git commit -m "feat: add complexity analyzer and prompt compiler"
```

---

### Task 8: Model Adapter

**Files:**
- Create: `src/engine/adapter.ts`
- Create: `src/engine/adapters/openai.ts`
- Create: `src/engine/adapters/claude.ts`
- Create: `tests/engine/adapter.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/engine/adapter.test.ts
import { describe, it, expect } from 'vitest';
import { createAdapter } from '../../src/engine/adapter.js';

describe('Model Adapter', () => {
  it('should create OpenAI adapter', () => {
    const adapter = createAdapter('openai', { apiKey: 'test-key' });
    expect(adapter.name).toBe('openai');
  });

  it('should create Claude adapter', () => {
    const adapter = createAdapter('claude', { apiKey: 'test-key' });
    expect(adapter.name).toBe('claude');
  });

  it('should throw for unknown adapter type', () => {
    expect(() => createAdapter('unknown' as any, { apiKey: 'test' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/engine/adapter.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/engine/adapter.ts**

```typescript
export interface AdapterConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ModelAdapter {
  name: string;
  complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse>;
  forward(request: unknown, protocol: 'openai' | 'anthropic'): Promise<unknown>;
}

export interface AdapterOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AdapterResponse {
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

import { OpenAIAdapter } from './adapters/openai.js';
import { ClaudeAdapter } from './adapters/claude.js';

export function createAdapter(type: 'openai' | 'claude', config: AdapterConfig): ModelAdapter {
  switch (type) {
    case 'openai': return new OpenAIAdapter(config);
    case 'claude': return new ClaudeAdapter(config);
    default: throw new Error(`Unknown adapter type: ${type}`);
  }
}
```

- [ ] **Step 4: Write src/engine/adapters/openai.ts**

```typescript
import OpenAI from 'openai';
import type { ModelAdapter, AdapterConfig, AdapterOptions, AdapterResponse } from '../adapter.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';

export class OpenAIAdapter implements ModelAdapter {
  name = 'openai';
  private client: OpenAI;

  constructor(config: AdapterConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: [
        ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    });
    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  async forward(request: unknown, _protocol: 'openai' | 'anthropic'): Promise<unknown> {
    const req = request as ProxyRequest;
    const response = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages as any,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
    });
    const result: ProxyResponse = {
      id: response.id,
      object: 'chat.completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map(c => ({
        index: c.index,
        message: { role: c.message?.role ?? 'assistant', content: c.message?.content ?? '' },
        finish_reason: c.finish_reason ?? 'stop',
      })),
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
      },
    };
    return result;
  }
}
```

- [ ] **Step 5: Write src/engine/adapters/claude.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ModelAdapter, AdapterConfig, AdapterOptions, AdapterResponse } from '../adapter.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';

export class ClaudeAdapter implements ModelAdapter {
  name = 'claude';
  private client: Anthropic;

  constructor(config: AdapterConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async complete(prompt: string, options: AdapterOptions): Promise<AdapterResponse> {
    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 2000,
      system: options.systemPrompt ?? 'You are a reasoning assistant.',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
    });
    const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async forward(request: unknown, _protocol: 'openai' | 'anthropic'): Promise<unknown> {
    const req = request as ProxyRequest;
    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.max_tokens ?? 2000,
      system: 'You are a helpful assistant.',
      messages: req.messages as any,
      temperature: req.temperature,
    });
    const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    // Convert Anthropic response to OpenAI format for consistency
    const result: ProxyResponse = {
      id: response.id,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
    return result;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run tests/engine/adapter.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/adapter.ts src/engine/adapters/ tests/engine/adapter.test.ts
git commit -m "feat: add model adapter with OpenAI and Claude implementations"
```

---

### Task 9: Storage & Engine Loop

**Files:**
- Create: `src/engine/storage.ts`
- Create: `src/engine/loop.ts`
- Create: `tests/engine/storage.test.ts`
- Create: `tests/engine/loop.test.ts`

- [ ] **Step 1: Write storage test + implementation**

```typescript
// tests/engine/storage.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { saveState, loadState, loadHistory } from '../../src/engine/storage.js';
import { initState } from '../../src/core/state.js';

describe('Storage Module', () => {
  let tmpDir: string;
  beforeAll(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-test-')); });

  it('should save and load state', async () => {
    const state = initState('test', 's1');
    await saveState(state, tmpDir);
    const loaded = await loadState(tmpDir, 0);
    expect(loaded.goal).toBe('test');
  });

  it('should load full history', async () => {
    const s0 = initState('test', 's1');
    const s1 = { ...s0, iteration: 1 };
    await saveState(s0, tmpDir);
    await saveState(s1, tmpDir);
    const history = await loadHistory(tmpDir);
    expect(history).toHaveLength(2);
  });
});
```

```typescript
// src/engine/storage.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ReasoningState } from '../core/types.js';

export async function saveState(state: ReasoningState, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `state-${String(state.iteration).padStart(4, '0')}.json`);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function loadState(outputDir: string, iteration: number): Promise<ReasoningState> {
  const filePath = path.join(outputDir, `state-${String(iteration).padStart(4, '0')}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as ReasoningState;
}

export async function loadHistory(outputDir: string): Promise<ReasoningState[]> {
  try {
    const files = (await fs.readdir(outputDir)).filter(f => f.startsWith('state-') && f.endsWith('.json')).sort();
    const states: ReasoningState[] = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(outputDir, file), 'utf-8');
      states.push(JSON.parse(content) as ReasoningState);
    }
    return states;
  } catch { return []; }
}
```

- [ ] **Step 2: Write loop test + implementation**

```typescript
// tests/engine/loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runLoop } from '../../src/engine/loop.js';
import type { ModelAdapter, AdapterResponse } from '../../src/engine/adapter.js';
import type { ServerConfig } from '../../src/core/types.js';

function createMockAdapter(responses: string[]): ModelAdapter {
  let idx = 0;
  return {
    name: 'mock',
    complete: vi.fn(async (): Promise<AdapterResponse> => ({
      content: responses[idx++ % responses.length] ?? '',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    })),
    forward: vi.fn(async () => ({})),
  };
}

describe('Engine Loop', () => {
  it('should run loop and converge', async () => {
    const adapter = createMockAdapter([
      'CLAIM: Test claim\nASSUMPTION: Test assumption\nQUESTION: What next?',
      'ISSUE: No evidence\nSUGGESTION: Add evidence',
      'CLAIM: Test claim\nEVIDENCE: Supporting data',
    ]);
    const config: ServerConfig = {
      port: 8080, provider: 'openai', model: 'test', apiKey: 'test',
      maxIterations: 3, budget: 100000, stabilityThreshold: 0.85, minIterations: 2,
      complexityThreshold: 0.5, outputDir: '/tmp/rl-loop-test', loopTimeoutMs: 60000,
    };
    const result = await runLoop('Test problem', 'session-1', config, adapter);
    expect(result.finalState.iteration).toBeGreaterThanOrEqual(2);
    expect(result.history.length).toBeGreaterThanOrEqual(2);
  });
});
```

```typescript
// src/engine/loop.ts
import type { ReasoningState, ServerConfig, TransitionInput } from '../core/types.js';
import type { ModelAdapter } from './adapter.js';
import { initState } from '../core/state.js';
import { extractStateFragment } from '../core/scratchpad.js';
import { buildPlannerPrompt } from '../core/planner.js';
import { buildCriticPrompt, parseCriticOutput } from '../core/critic.js';
import { buildAdversaryPrompt, parseAdversaryOutput } from '../core/adversary.js';
import { noopValidator } from '../core/validator.js';
import { decide } from '../core/policy.js';
import { transition } from '../core/transition.js';
import { checkConvergence } from '../core/convergence.js';
import { compileState } from '../core/compiler.js';
import { saveState } from './storage.js';

export async function runLoop(
  goal: string,
  sessionId: string,
  config: ServerConfig,
  adapter: ModelAdapter,
): Promise<{ finalState: ReasoningState; history: ReasoningState[] }> {
  let state = initState(goal, sessionId, config.budget);
  const history: ReasoningState[] = [state];

  const convergenceConfig = {
    maxIterations: config.maxIterations,
    budgetLimit: config.budget,
    stabilityThreshold: config.stabilityThreshold,
    minIterations: config.minIterations,
    complexityThreshold: config.complexityThreshold,
  };

  while (true) {
    const decision = decide(state, convergenceConfig);
    if (decision.nextAction === 'stop') break;

    // 1. Planner
    const plannerPrompt = compileState(state, decision.nextAction, 'planner');
    const plannerResponse = await adapter.complete(plannerPrompt.user, {
      model: config.model, systemPrompt: plannerPrompt.system,
    });
    state.metadata.budgetRemaining -= plannerResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += plannerResponse.usage.totalTokens;
    const stateFragment = extractStateFragment(plannerResponse.content, state.iteration + 1);

    // 2. Critic
    const criticPrompt = buildCriticPrompt(state);
    const criticResponse = await adapter.complete(criticPrompt, {
      model: config.model, systemPrompt: 'You are a critical reasoning evaluator.',
    });
    const criticOutput = parseCriticOutput(criticResponse.content);
    state.metadata.budgetRemaining -= criticResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += criticResponse.usage.totalTokens;

    // 3. Adversary (if Policy decides)
    let adversaryOutput = null;
    if (decision.nextAction === 'attack') {
      const adversaryPrompt = buildAdversaryPrompt(state);
      const adversaryResponse = await adapter.complete(adversaryPrompt, {
        model: config.model, systemPrompt: 'You are an adversary. Attack the reasoning.',
      });
      adversaryOutput = parseAdversaryOutput(adversaryResponse.content);
      state.metadata.budgetRemaining -= adversaryResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += adversaryResponse.usage.totalTokens;
    }

    // 4. Validator (no-op in MVP)
    const validatorResults = [await noopValidator.validate(state)];

    // 5. Transition
    const transitionInput: TransitionInput = {
      scratchpad: plannerResponse.content,
      stateFragment,
      critic: criticOutput,
      adversary: adversaryOutput,
      validatorResults,
    };
    state = transition(state, transitionInput, decision.nextAction);

    history.push(state);
    try { await saveState(state, config.outputDir); } catch { /* ignore storage errors */ }

    if (checkConvergence(state, convergenceConfig)) break;
  }

  return { finalState: state, history };
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/engine/
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/storage.ts src/engine/loop.ts tests/engine/storage.test.ts tests/engine/loop.test.ts
git commit -m "feat: add storage and reasoning loop engine"
```

---

### Task 10: Gateway (Proxy Server)

**Files:**
- Create: `src/gateway/types.ts`
- Create: `src/gateway/middleware.ts`
- Create: `src/gateway/routes/openai.ts`
- Create: `src/gateway/routes/anthropic.ts`
- Create: `src/gateway/server.ts`
- Create: `tests/gateway/openai.test.ts`

- [ ] **Step 1: Write src/gateway/types.ts**

```typescript
import type { ProxyRequest, ProxyResponse, ServerConfig } from '../../core/types.js';

export type { ProxyRequest, ProxyResponse, ServerConfig };

export interface GatewayContext {
  config: ServerConfig;
  sessions: Map<string, import('../../core/types.js').ReasoningState>;
}
```

- [ ] **Step 2: Write src/gateway/middleware.ts**

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requestIdMiddleware(request: FastifyRequest, reply: FastifyReply) {
  reply.header('x-reasonloop-request-id', request.id);
}

export async function errorHandler(error: Error, _request: FastifyRequest, reply: FastifyReply) {
  reply.status(500).send({
    error: { message: error.message, type: 'reasonloop_error' },
  });
}
```

- [ ] **Step 3: Write src/gateway/routes/openai.ts**

```typescript
import type { FastifyInstance } from 'fastify';
import type { GatewayContext } from '../types.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';
import { analyzeComplexity } from '../../core/complexity.js';
import { initState } from '../../core/state.js';
import { runLoop } from '../../engine/loop.js';
import { compileFinalResponse } from '../../core/compiler.js';
import { createAdapter } from '../../engine/adapter.js';

export async function registerOpenAIRoutes(app: FastifyInstance, ctx: GatewayContext) {
  app.post('/v1/chat/completions', async (request, reply) => {
    const req = request.body as ProxyRequest;
    const adapter = createAdapter(ctx.config.provider, { apiKey: ctx.config.apiKey, baseUrl: ctx.config.baseUrl });

    // Complexity analysis
    const analysis = analyzeComplexity(req, ctx.config.complexityThreshold);

    if (!analysis.shouldLoop) {
      // Passthrough
      const response = await adapter.forward(req, 'openai') as ProxyResponse;
      return reply.send(response);
    }

    // Reasoning loop
    const goal = req.messages[req.messages.length - 1]?.content ?? '';
    const sessionId = `session-${Date.now()}`;
    const result = await runLoop(goal, sessionId, ctx.config, adapter);
    ctx.sessions.set(sessionId, result.finalState);

    // Compile and format response
    const compiled = compileFinalResponse(result.finalState, req.messages);
    const response: ProxyResponse = {
      id: sessionId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: req.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: compiled },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: result.finalState.metadata.totalTokensUsed,
        completion_tokens: 0,
        total_tokens: result.finalState.metadata.totalTokensUsed,
      },
    };

    return reply.send(response);
  });
}
```

- [ ] **Step 4: Write src/gateway/routes/anthropic.ts**

```typescript
import type { FastifyInstance } from 'fastify';
import type { GatewayContext } from '../types.js';
import type { ProxyRequest, ProxyResponse } from '../../core/types.js';
import { analyzeComplexity } from '../../core/complexity.js';
import { runLoop } from '../../engine/loop.js';
import { compileFinalResponse } from '../../core/compiler.js';
import { createAdapter } from '../../engine/adapter.js';

export async function registerAnthropicRoutes(app: FastifyInstance, ctx: GatewayContext) {
  app.post('/v1/messages', async (request, reply) => {
    const body = request.body as any;
    const req: ProxyRequest = {
      model: body.model,
      messages: body.messages ?? [],
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    };
    const adapter = createAdapter(ctx.config.provider, { apiKey: ctx.config.apiKey, baseUrl: ctx.config.baseUrl });

    const analysis = analyzeComplexity(req, ctx.config.complexityThreshold);

    if (!analysis.shouldLoop) {
      const response = await adapter.forward(req, 'anthropic');
      return reply.send(response);
    }

    const goal = req.messages[req.messages.length - 1]?.content ?? '';
    const sessionId = `session-${Date.now()}`;
    const result = await runLoop(goal, sessionId, ctx.config, adapter);
    ctx.sessions.set(sessionId, result.finalState);

    const compiled = compileFinalResponse(result.finalState, req.messages);

    // Anthropic format response
    return reply.send({
      id: sessionId,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: compiled }],
      model: body.model,
      stop_reason: 'end_turn',
      usage: { input_tokens: result.finalState.metadata.totalTokensUsed, output_tokens: 0 },
    });
  });
}
```

- [ ] **Step 5: Write src/gateway/server.ts**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { ServerConfig } from '../core/types.js';
import type { GatewayContext } from './types.js';
import { requestIdMiddleware, errorHandler } from './middleware.js';
import { registerOpenAIRoutes } from './routes/openai.js';
import { registerAnthropicRoutes } from './routes/anthropic.js';

export async function startServer(config: ServerConfig): Promise<void> {
  const app = Fastify({ logger: true });
  const ctx: GatewayContext = { config, sessions: new Map() };

  await app.register(cors, { origin: true });

  app.addHook('onRequest', requestIdMiddleware);
  app.setErrorHandler(errorHandler);

  await registerOpenAIRoutes(app, ctx);
  await registerAnthropicRoutes(app, ctx);

  // Health check
  app.get('/v1/models', async () => ({
    object: 'list',
    data: [{ id: config.model, object: 'model', owned_by: 'reasonloop' }],
  }));

  // Sessions endpoint for CLI
  app.get('/v1/sessions', async () => ({
    sessions: [...ctx.sessions.entries()].map(([id, state]) => ({
      id,
      goal: state.goal,
      iteration: state.iteration,
      stability: state.metadata.stability,
      claims: state.claims.length,
    })),
  }));

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`ReasonLoop Gateway running on port ${config.port}`);
}
```

- [ ] **Step 6: Write a basic gateway test**

```typescript
// tests/gateway/openai.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../../src/core/complexity.js';
import type { ProxyRequest } from '../../src/core/types.js';

describe('Gateway Integration', () => {
  it('should correctly classify request complexity for routing', () => {
    const simple: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'What is TCP?' }] };
    const complex: ProxyRequest = { model: 'gpt-4', messages: [{ role: 'user', content: 'Design a Minecraft launcher architecture' }] };

    expect(analyzeComplexity(simple).shouldLoop).toBe(false);
    expect(analyzeComplexity(complex).shouldLoop).toBe(true);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npx vitest run tests/gateway/
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/gateway/ tests/gateway/
git commit -m "feat: add gateway proxy server with OpenAI and Anthropic routes"
```

---

### Task 11: CLI Control Panel

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/commands/start.ts`
- Create: `src/cli/commands/status.ts`
- Create: `src/cli/commands/sessions.ts`
- Create: `src/cli/commands/inspect.ts`
- Create: `src/cli/output.ts`
- Create: `tests/cli/commands.test.ts`

- [ ] **Step 1: Write src/cli/output.ts**

```typescript
import chalk from 'chalk';
import type { ReasoningState } from '../core/types.js';

export function formatSession(state: ReasoningState): string {
  return `[${state.id}] "${state.goal}" | ${state.iteration} iterations | stability: ${state.metadata.stability.toFixed(2)} | claims: ${state.claims.length}`;
}

export function formatIteration(state: ReasoningState): string {
  const actionColors: Record<string, typeof chalk.yellow> = {
    expand: chalk.green, refine: chalk.blue, verify: chalk.magenta, attack: chalk.red, stop: chalk.gray,
  };
  const colorFn = actionColors[state.metadata.lastAction] ?? chalk.white;
  return `[Iter ${state.iteration}] ${colorFn(state.metadata.lastAction)} | stability: ${state.metadata.stability.toFixed(2)} | claims: ${state.claims.length} | questions: ${state.openQuestions.length}`;
}
```

- [ ] **Step 2: Write src/cli/commands/start.ts**

```typescript
import type { Command } from 'commander';
import { startServer } from '../../gateway/server.js';
import type { ServerConfig } from '../../core/types.js';

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the ReasonLoop proxy server')
    .option('-p, --port <port>', 'Port number', '8080')
    .option('--provider <provider>', 'LLM provider (openai or claude)', 'openai')
    .option('-m, --model <model>', 'Model name', 'gpt-4')
    .option('--max-iterations <n>', 'Max reasoning iterations', '10')
    .option('--budget <n>', 'Token budget', '100000')
    .option('--complexity-threshold <n>', 'Complexity threshold for looping', '0.5')
    .option('-o, --output-dir <dir>', 'Output directory', './reasonloop-output')
    .action(async (options: Record<string, unknown>) => {
      const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) {
        console.error('Error: Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
        process.exit(1);
      }

      const config: ServerConfig = {
        port: Number(options.port),
        provider: options.provider as 'openai' | 'claude',
        model: options.model as string,
        apiKey,
        maxIterations: Number(options.maxIterations),
        budget: Number(options.budget),
        stabilityThreshold: 0.85,
        minIterations: 2,
        complexityThreshold: Number(options.complexityThreshold),
        outputDir: options.outputDir as string,
        loopTimeoutMs: 60000,
      };

      await startServer(config);
    });
}
```

- [ ] **Step 3: Write src/cli/commands/status.ts**

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check ReasonLoop server status')
    .option('-p, --port <port>', 'Port number', '8080')
    .action(async (options: Record<string, unknown>) => {
      const port = Number(options.port);
      try {
        const response = await fetch(`http://localhost:${port}/v1/models`);
        const data = await response.json();
        console.log(chalk.green(`ReasonLoop running on :${port}`));
        console.log(`Available models: ${JSON.stringify(data)}`);
      } catch {
        console.log(chalk.red(`ReasonLoop not running on :${port}`));
      }
    });
}
```

- [ ] **Step 4: Write src/cli/commands/sessions.ts**

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';

export function registerSessionsCommand(program: Command): void {
  program
    .command('sessions')
    .description('List all reasoning sessions')
    .option('-p, --port <port>', 'Port number', '8080')
    .action(async (options: Record<string, unknown>) => {
      const port = Number(options.port);
      try {
        const response = await fetch(`http://localhost:${port}/v1/sessions`);
        const data = await response.json() as any;
        if (data.sessions.length === 0) {
          console.log(chalk.yellow('No active sessions.'));
        } else {
          for (const s of data.sessions) {
            console.log(`[${s.id}] "${s.goal}" | ${s.iteration} iterations | stability: ${s.stability.toFixed(2)} | claims: ${s.claims}`);
          }
        }
      } catch {
        console.log(chalk.red('Cannot connect to ReasonLoop server.'));
      }
    });
}
```

- [ ] **Step 5: Write src/cli/commands/inspect.ts**

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect <sessionId>')
    .description('Inspect a reasoning session')
    .option('-p, --port <port>', 'Port number', '8080')
    .option('--diff <range>', 'Show diff between iterations (e.g. 2-3)')
    .action(async (sessionId: string, options: Record<string, unknown>) => {
      const port = Number(options.port);
      try {
        const response = await fetch(`http://localhost:${port}/v1/sessions`);
        const data = await response.json() as any;
        const session = data.sessions.find((s: any) => s.id === sessionId);
        if (!session) {
          console.log(chalk.yellow(`Session ${sessionId} not found.`));
          return;
        }
        console.log(chalk.bold(`Session: ${session.id}`));
        console.log(`Goal: ${session.goal}`);
        console.log(`Iterations: ${session.iteration}`);
        console.log(`Stability: ${session.stability.toFixed(2)}`);
        console.log(`Claims: ${session.claims}`);
      } catch {
        console.log(chalk.red('Cannot connect to ReasonLoop server.'));
      }
    });
}
```

- [ ] **Step 6: Write src/cli/index.ts**

```typescript
import { Command } from 'commander';
import { registerStartCommand } from './commands/start.js';
import { registerStatusCommand } from './commands/status.js';
import { registerSessionsCommand } from './commands/sessions.js';
import { registerInspectCommand } from './commands/inspect.js';

export function runCLI(): void {
  const program = new Command();
  program
    .name('reasonloop')
    .description('ReasonLoop — A reasoning middleware between agents and models')
    .version('0.1.0');

  registerStartCommand(program);
  registerStatusCommand(program);
  registerSessionsCommand(program);
  registerInspectCommand(program);

  program.parse();
}

// Run if called directly
if (process.argv[1]?.endsWith('cli/index.js') || process.argv[1]?.endsWith('cli/index.ts')) {
  runCLI();
}
```

- [ ] **Step 7: Write test**

```typescript
// tests/cli/commands.test.ts
import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerStartCommand } from '../../src/cli/commands/start.js';
import { registerStatusCommand } from '../../src/cli/commands/status.js';
import { registerSessionsCommand } from '../../src/cli/commands/sessions.js';
import { registerInspectCommand } from '../../src/cli/commands/inspect.js';

describe('CLI Commands', () => {
  it('should register all commands', () => {
    const program = new Command();
    registerStartCommand(program);
    registerStatusCommand(program);
    registerSessionsCommand(program);
    registerInspectCommand(program);
    expect(program.commands.map(c => c.name())).toContain('start');
    expect(program.commands.map(c => c.name())).toContain('status');
    expect(program.commands.map(c => c.name())).toContain('sessions');
    expect(program.commands.map(c => c.name())).toContain('inspect');
  });
});
```

- [ ] **Step 8: Run tests**

```bash
npx vitest run tests/cli/
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/cli/ tests/cli/
git commit -m "feat: add CLI control panel with start, status, sessions, inspect"
```

---

### Task 12: Library Entry & Final Integration

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update src/index.ts**

```typescript
// ReasonLoop Middleware - Library Entry

// Core types
export type {
  Claim, Assumption, Evidence, Controversy, ReasoningState, StateMetadata,
  CriticOutput, Decision, PolicyDecision, ComplexityAnalysis, CompiledPrompt,
  ValidationResult, Validator, ConvergenceConfig, TransitionInput,
  ProxyRequest, ProxyResponse, ServerConfig,
} from './core/types.js';

// Core functions
export { initState, addClaim, addAssumption, addEvidence, computeStability, diffStates } from './core/state.js';
export { buildScratchpadPrompt, extractStateFragment } from './core/scratchpad.js';
export { buildPlannerPrompt } from './core/planner.js';
export { buildCriticPrompt, parseCriticOutput } from './core/critic.js';
export { buildAdversaryPrompt, parseAdversaryOutput } from './core/adversary.js';
export { noopValidator } from './core/validator.js';
export { decide } from './core/policy.js';
export { transition } from './core/transition.js';
export { checkConvergence } from './core/convergence.js';
export { analyzeComplexity } from './core/complexity.js';
export { compileState, compileFinalResponse } from './core/compiler.js';

// Engine
export { createAdapter } from './engine/adapter.js';
export type { ModelAdapter, AdapterConfig, AdapterOptions, AdapterResponse } from './engine/adapter.js';
export { runLoop } from './engine/loop.js';
export { saveState, loadState, loadHistory } from './engine/storage.js';

// Gateway
export { startServer } from './gateway/server.js';
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

- [ ] **Step 4: Commit and push**

```bash
git add src/index.ts
git commit -m "feat: add library entry point with full public API exports"
git push origin main || git push origin master
```

---

### Task 13: Final Verification

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

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "chore: final integration and verification"
git push origin main || git push origin master
```
