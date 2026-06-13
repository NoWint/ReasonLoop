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
