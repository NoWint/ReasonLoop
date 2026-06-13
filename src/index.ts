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
export type { LoopCallbacks, LoopOptions } from './engine/loop.js';
export { saveState, loadState, loadHistory } from './engine/storage.js';

// Gateway
export { startServer } from './gateway/server.js';

// Config
export { loadConfig } from './config/index.js';
export type { ReasonLoopConfig } from './config/index.js';
export { ReasonLoopConfigSchema } from './config/schema.js';

// Observability
export { createLogger } from './observability/logger.js';
export { createMetricsRegistry } from './observability/metrics.js';
export type { MetricsRegistry } from './observability/metrics.js';
export { setupTracing, createSpan, createAsyncSpan } from './observability/tracing.js';

// Retry
export { retryWithBackoff } from './core/retry.js';
export type { RetryOptions } from './core/retry.js';

// Storage (SQLite)
export { SQLiteStorage } from './engine/storage-sqlite.js';
export type { SessionRecord, IterationRecord } from './engine/storage.js';
export type { Storage } from './engine/storage.js';

// Gateway streaming
export { emitAsSSE, formatOpenAIStreamChunk, formatAnthropicStreamEvents } from './gateway/stream.js';

// Gateway auth
export { createAuthHook } from './gateway/auth.js';

// Validators
export {
  RegexRuleValidator, JsonSchemaRuleValidator,
  SafeEvalValidator, DockerSandboxValidator,
  RetrievalValidator, NoopSearchProvider,
  CompositeValidator,
} from './validators/index.js';
export type {
  RegexRuleValidatorConfig, JsonSchemaRuleValidatorConfig,
  SafeEvalValidatorConfig,
  RetrievalValidatorConfig, SearchProvider, SearchResult,
  CompositeValidatorConfig,
} from './validators/index.js';
