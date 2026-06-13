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
  confidence: number;                // 0-1
  source: 'code' | 'retrieval' | 'rule' | 'noop';
}

export interface Validator {
  name: string;
  validate(state: ReasoningState, claim?: Claim): Promise<ValidationResult>;
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

export interface ReasoningView {
  id: string;
  name: string;
  systemPrompt: string;
  focusAreas: string[];
  weight: number;                  // 0-1, used for weighted synthesis
}

export interface SynthesisResult {
  consensus: Claim[];
  conflicts: Controversy[];
  synthesized: ReasoningState;
}

export interface MemoryEntry {
  id: string;
  sessionId: string;
  goal: string;
  claims: string[];
  lessons: string[];
  embedding: number[];
  timestamp: number;
  tags: string[];
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
