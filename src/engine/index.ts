/**
 * ReasonLoop Engine - High-level API for integrating reasoning capabilities.
 *
 * Usage:
 *   import { ReasonLoop } from 'reasonloop';
 *
 *   const engine = new ReasonLoop({ provider: 'openai', apiKey: 'sk-xxx' });
 *   const result = await engine.reason('Analyze the tradeoffs of microservices');
 */

import { createAdapter, type ModelAdapter, type AdapterConfig } from '../engine/adapter.js';
import { runLoop, type LoopCallbacks, type LoopOptions } from '../engine/loop.js';
import { runTeamDebate, BUILT_IN_AGENTS, type DebateCallbacks, type DebateOptions } from '../engine/team-debate.js';
import { analyzeComplexity } from '../core/complexity.js';
import { compileFinalResponse } from '../core/compiler.js';
import { initState } from '../core/state.js';
import { v4 as uuid } from 'uuid';
import type { ReasoningState, ServerConfig, TeamAgent, TeamDebateResult, ConsensusPoint, IrreconcilableConflict } from '../core/types.js';
import { loadConfig, type ReasonLoopConfig } from '../config/index.js';

// ─── Engine Configuration ───────────────────────────────────────────

export interface ReasonLoopEngineConfig {
  /** LLM provider: 'openai' | 'claude' */
  provider?: 'openai' | 'claude';
  /** API key for the provider */
  apiKey?: string;
  /** Custom base URL (e.g. https://api.deepseek.com) */
  baseUrl?: string;
  /** Model name (e.g. deepseek-chat, gpt-4, claude-3-opus) */
  model?: string;
  /** Max reasoning iterations (default: 10) */
  maxIterations?: number;
  /** Token budget limit (default: 100000) */
  budget?: number;
  /** Complexity threshold for triggering reasoning loop (default: 0.3) */
  complexityThreshold?: number;
  /** Stability threshold for convergence (default: 0.8) */
  stabilityThreshold?: number;
  /** Min iterations before checking convergence (default: 2) */
  minIterations?: number;
  /** Loop timeout in ms (default: 300000 = 5min) */
  timeout?: number;
  /** Enable multi-view reasoning by default (default: false) */
  multiView?: boolean;
  /** Storage directory for state persistence (default: './data/reasonloop') */
  outputDir?: string;
}

// ─── Reasoning Options ──────────────────────────────────────────────

export interface ReasonOptions {
  /** Force reasoning loop regardless of complexity (default: false) */
  forceLoop?: boolean;
  /** Override complexity threshold for this call */
  complexityThreshold?: number;
  /** Enable multi-view reasoning for this call */
  multiView?: boolean;
  /** Max iterations override for this call */
  maxIterations?: number;
  /** Budget override for this call */
  budget?: number;
  /** Run roles in parallel (default: true) */
  parallel?: boolean;
  /** Stream callbacks for real-time output */
  onScratchpadStart?: () => void;
  onScratchpadChunk?: (chunk: string) => void;
  onScratchpadComplete?: (content: string, duration: number) => void;
  onPlannerStart?: () => void;
  onPlannerChunk?: (chunk: string) => void;
  onPlannerComplete?: (content: string, duration: number) => void;
  onCriticStart?: () => void;
  onCriticChunk?: (chunk: string) => void;
  onCriticComplete?: (output: string, duration: number) => void;
  onAdversaryStart?: () => void;
  onAdversaryChunk?: (chunk: string) => void;
  onAdversaryComplete?: (output: string, duration: number) => void;
  onViewStart?: (viewName: string) => void;
  onViewChunk?: (viewName: string, chunk: string) => void;
  onViewComplete?: (viewName: string, content: string, duration: number) => void;
  onSynthesisComplete?: (consensus: number, conflicts: number) => void;
  onIterationComplete?: (iteration: number, stability: number, nextAction: string) => void;
}

// ─── Reasoning Result ───────────────────────────────────────────────

export interface ReasonResult {
  /** The final compiled answer */
  answer: string;
  /** The full reasoning state */
  state: ReasoningState;
  /** Whether reasoning loop was triggered */
  reasoned: boolean;
  /** Complexity score (0-1) */
  complexity: number;
  /** Number of iterations run */
  iterations: number;
  /** Total tokens consumed */
  totalTokens: number;
  /** Final stability score */
  stability: number;
  /** Claims extracted during reasoning */
  claims: ReasoningState['claims'];
  /** Open questions remaining */
  openQuestions: ReasoningState['openQuestions'];
  /** Assumptions made */
  assumptions: ReasoningState['assumptions'];
  /** Evidence gathered */
  evidence: ReasoningState['evidence'];
}

// ─── Debate Options & Result ────────────────────────────────────────

export interface DebateMethodOptions {
  /** Custom agents (default: 4 built-in agents) */
  agents?: TeamAgent[];
  /** Number of debate rounds (default: 3) */
  rounds?: number;
  /** Run agents in parallel within a round (default: true) */
  parallel?: boolean;
  /** Stream callbacks */
  onRoundStart?: (round: number, type: string) => void;
  onAgentStart?: (agent: TeamAgent, round: number) => void;
  onAgentChunk?: (agentId: string, chunk: string) => void;
  onAgentComplete?: (agent: TeamAgent, response: string, duration: number) => void;
  onRoundComplete?: (round: number, type: string, duration: number) => void;
}

export interface DebateResult {
  /** The final synthesis from all agents */
  answer: string;
  /** Full debate result */
  debate: TeamDebateResult;
  /** Consensus points reached */
  consensus: ConsensusPoint[];
  /** Irreconcilable conflicts */
  conflicts: IrreconcilableConflict[];
  /** Total tokens consumed */
  totalTokens: number;
  /** Total duration in ms */
  totalDuration: number;
  /** Number of rounds */
  rounds: number;
  /** Number of agents */
  agentCount: number;
}

// ─── ReasonLoop Engine Class ────────────────────────────────────────

export class ReasonLoop {
  private config: Required<ReasonLoopEngineConfig>;
  private adapter: ModelAdapter;

  constructor(config: ReasonLoopEngineConfig = {}) {
    // Resolve config with env vars and defaults
    const provider = config.provider ?? (process.env.ANTHROPIC_API_KEY ? 'claude' : 'openai');
    const apiKey = config.apiKey
      ?? (provider === 'claude' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY)
      ?? '';

    this.config = {
      provider,
      apiKey,
      baseUrl: config.baseUrl ?? (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'),
      model: config.model ?? (provider === 'claude' ? 'claude-3-opus-20240229' : 'gpt-4'),
      maxIterations: config.maxIterations ?? 10,
      budget: config.budget ?? 100000,
      complexityThreshold: config.complexityThreshold ?? 0.3,
      stabilityThreshold: config.stabilityThreshold ?? 0.8,
      minIterations: config.minIterations ?? 2,
      timeout: config.timeout ?? 300000,
      multiView: config.multiView ?? false,
      outputDir: config.outputDir ?? './data/reasonloop',
    };

    // Create adapter
    const adapterConfig: AdapterConfig = {
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
    };
    this.adapter = createAdapter(provider, adapterConfig);
  }

  /**
   * Main reasoning method. Automatically detects complexity and either
   * passes through to the LLM or runs the full reasoning loop.
   */
  async reason(question: string, options: ReasonOptions = {}): Promise<ReasonResult> {
    // Analyze complexity
    const threshold = options.complexityThreshold ?? this.config.complexityThreshold;
    const complexity = analyzeComplexity(
      { model: this.config.model, messages: [{ role: 'user', content: question }] },
      threshold,
    );

    const shouldLoop = options.forceLoop || complexity.shouldLoop;

    if (!shouldLoop) {
      // Low complexity - direct LLM call
      const response = await this.adapter.complete(question, {
        model: this.config.model,
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.7,
        maxTokens: 2000,
      });

      const state = initState(question, uuid(), this.config.budget);
      state.metadata.totalTokensUsed = response.usage.totalTokens;

      return {
        answer: response.content,
        state,
        reasoned: false,
        complexity: complexity.score,
        iterations: 0,
        totalTokens: response.usage.totalTokens,
        stability: 1,
        claims: [],
        openQuestions: [],
        assumptions: [],
        evidence: [],
      };
    }

    // High complexity - run reasoning loop
    const serverConfig: ServerConfig = {
      port: 8080,
      provider: this.config.provider,
      model: this.config.model,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      maxIterations: options.maxIterations ?? this.config.maxIterations,
      budget: options.budget ?? this.config.budget,
      stabilityThreshold: this.config.stabilityThreshold,
      minIterations: this.config.minIterations,
      complexityThreshold: threshold,
      outputDir: this.config.outputDir,
      loopTimeoutMs: this.config.timeout,
      multiView: {
        enabled: options.multiView ?? this.config.multiView,
      },
    };

    // Map user callbacks to LoopCallbacks
    const callbacks: LoopCallbacks = {
      onScratchpadStart: options.onScratchpadStart,
      onScratchpadChunk: options.onScratchpadChunk,
      onScratchpadComplete: options.onScratchpadComplete,
      onPlannerStart: options.onPlannerStart,
      onPlannerChunk: options.onPlannerChunk,
      onPlannerComplete: options.onPlannerComplete,
      onCriticStart: options.onCriticStart,
      onCriticChunk: options.onCriticChunk,
      onCriticComplete: options.onCriticComplete
        ? (output, raw, duration) => options.onCriticComplete!(raw, duration)
        : undefined,
      onAdversaryStart: options.onAdversaryStart,
      onAdversaryChunk: options.onAdversaryChunk,
      onAdversaryComplete: options.onAdversaryComplete
        ? (output, raw, duration) => options.onAdversaryComplete!(raw, duration)
        : undefined,
      onViewStart: options.onViewStart
        ? (view) => options.onViewStart!(view.name)
        : undefined,
      onViewChunk: options.onViewChunk
        ? (view, chunk) => options.onViewChunk!(view.name, chunk)
        : undefined,
      onViewComplete: options.onViewComplete
        ? (view, content, duration) => options.onViewComplete!(view.name, content, duration)
        : undefined,
      onSynthesisComplete: options.onSynthesisComplete
        ? (result) => options.onSynthesisComplete!(result.consensus.length, result.conflicts.length)
        : undefined,
      onIterationComplete: options.onIterationComplete
        ? (state, decision) => options.onIterationComplete!(state.iteration, state.metadata.stability, decision.nextAction)
        : undefined,
    };

    const loopOptions: LoopOptions = {
      multiView: { enabled: options.multiView ?? this.config.multiView },
      callbacks,
      parallel: options.parallel ?? true,
    };

    const sessionId = uuid();
    const { finalState } = await runLoop(question, sessionId, serverConfig, this.adapter, loopOptions);

    const answer = compileFinalResponse(finalState, []);

    return {
      answer,
      state: finalState,
      reasoned: true,
      complexity: complexity.score,
      iterations: finalState.iteration,
      totalTokens: finalState.metadata.totalTokensUsed,
      stability: finalState.metadata.stability,
      claims: finalState.claims,
      openQuestions: finalState.openQuestions,
      assumptions: finalState.assumptions,
      evidence: finalState.evidence,
    };
  }

  /**
   * Team debate mode. Multiple agents with different perspectives
   * debate the topic through structured rounds (opening, rebuttal, defense, synthesis).
   * Agents can challenge, support, or concede to each other.
   */
  async debate(topic: string, options: DebateMethodOptions = {}): Promise<DebateResult> {
    const callbacks: DebateCallbacks = {
      onRoundStart: options.onRoundStart
        ? (round, type) => options.onRoundStart!(round, type)
        : undefined,
      onAgentStart: options.onAgentStart,
      onAgentChunk: options.onAgentChunk,
      onAgentComplete: options.onAgentComplete
        ? (agent, response, duration) => options.onAgentComplete!(agent, response.content, duration)
        : undefined,
      onRoundComplete: options.onRoundComplete
        ? (round) => options.onRoundComplete!(round.round, round.type, round.duration)
        : undefined,
    };

    const debateOptions: DebateOptions = {
      agents: options.agents,
      rounds: options.rounds ?? 3,
      callbacks,
      parallel: options.parallel ?? true,
    };

    const result = await runTeamDebate(topic, this.adapter, this.config.model, debateOptions);

    // Build answer from consensus + synthesis
    const consensusText = result.consensus.length > 0
      ? result.consensus.map(c => `- ${c.content} (${c.agreeingAgents.length} agents agree, confidence: ${(c.confidence * 100).toFixed(0)}%)`).join('\n')
      : 'No consensus reached.';
    const conflictText = result.conflicts.length > 0
      ? result.conflicts.map(c => `- ${c.description}\n  Positions: ${c.positions.map(p => `${p.agentId}: ${p.stance}`).join(' | ')}`).join('\n')
      : 'No irreconcilable conflicts.';
    const answer = `# Consensus\n${consensusText}\n\n# Conflicts\n${conflictText}\n\n# Final Synthesis\n${result.finalSynthesis}`;

    return {
      answer,
      debate: result,
      consensus: result.consensus,
      conflicts: result.conflicts,
      totalTokens: result.totalTokens,
      totalDuration: result.totalDuration,
      rounds: result.rounds.length,
      agentCount: result.agents.length,
    };
  }

  /**
   * Start the proxy server. Other agents can connect to it
   * by changing their baseURL to http://localhost:{port}/v1
   */
  async serve(options: { port?: number; host?: string } = {}): Promise<void> {
    const { startServer } = await import('../gateway/server.js');
    const serverConfig: ServerConfig = {
      port: options.port ?? 8080,
      provider: this.config.provider,
      model: this.config.model,
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      maxIterations: this.config.maxIterations,
      budget: this.config.budget,
      stabilityThreshold: this.config.stabilityThreshold,
      minIterations: this.config.minIterations,
      complexityThreshold: this.config.complexityThreshold,
      outputDir: this.config.outputDir,
      loopTimeoutMs: this.config.timeout,
      multiView: { enabled: this.config.multiView },
    };
    await startServer(serverConfig);
  }

  /**
   * Quick complexity check without running reasoning.
   */
  analyzeComplexity(question: string): { score: number; shouldLoop: boolean } {
    return analyzeComplexity(
      { model: this.config.model, messages: [{ role: 'user', content: question }] },
      this.config.complexityThreshold,
    );
  }

  /**
   * Get current engine configuration (without API key).
   */
  getConfig(): Omit<Required<ReasonLoopEngineConfig>, 'apiKey'> {
    const { apiKey: _, ...rest } = this.config;
    return rest;
  }
}

// ─── Convenience Factory ────────────────────────────────────────────

/**
 * Create a ReasonLoop engine with minimal config.
 *
 * @example
 * import { createEngine } from 'reasonloop';
 *
 * const engine = createEngine({
 *   apiKey: 'sk-xxx',
 *   baseUrl: 'https://api.deepseek.com',
 *   model: 'deepseek-chat',
 * });
 *
 * const result = await engine.reason('Analyze microservices tradeoffs');
 * console.log(result.answer);
 */
export function createEngine(config: ReasonLoopEngineConfig = {}): ReasonLoop {
  return new ReasonLoop(config);
}
