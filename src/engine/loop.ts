import type { ReasoningState, ServerConfig, TransitionInput } from '../core/types.js';
import type { ModelAdapter } from './adapter.js';
import { initState } from '../core/state.js';
import { buildScratchpadPrompt, extractStateFragment } from '../core/scratchpad.js';
import { buildPlannerPrompt } from '../core/planner.js';
import { buildCriticPrompt, parseCriticOutput } from '../core/critic.js';
import { buildAdversaryPrompt, parseAdversaryOutput } from '../core/adversary.js';
import { noopValidator } from '../core/validator.js';
import { decide } from '../core/policy.js';
import { transition } from '../core/transition.js';
import { checkConvergence } from '../core/convergence.js';
import { saveState } from './storage.js';
import { retryWithBackoff } from '../core/retry.js';

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

  const retryOpts = { maxRetries: 3, baseDelay: 1000 };
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > config.loopTimeoutMs) break;

    const decision = decide(state, convergenceConfig);
    if (decision.nextAction === 'stop') break;

    // 0. Scratchpad (divergent exploration)
    const scratchpadPrompt = buildScratchpadPrompt(state, decision.nextAction);
    const scratchpadResponse = await retryWithBackoff(
      () => adapter.complete(scratchpadPrompt, {
        model: config.model, systemPrompt: 'You are a free-thinking explorer. No structure, just explore.',
      }),
      retryOpts,
    );
    state.metadata.budgetRemaining -= scratchpadResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += scratchpadResponse.usage.totalTokens;

    // 1. Planner (structured extraction from scratchpad output)
    const plannerPrompt = buildPlannerPrompt(state, decision.nextAction, scratchpadResponse.content);
    const plannerResponse = await retryWithBackoff(
      () => adapter.complete(plannerPrompt.user, {
        model: config.model, systemPrompt: plannerPrompt.system,
      }),
      retryOpts,
    );
    state.metadata.budgetRemaining -= plannerResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += plannerResponse.usage.totalTokens;
    const stateFragment = extractStateFragment(plannerResponse.content, state.iteration + 1);

    // 2. Critic
    const criticPrompt = buildCriticPrompt(state);
    const criticResponse = await retryWithBackoff(
      () => adapter.complete(criticPrompt, {
        model: config.model, systemPrompt: 'You are a critical reasoning evaluator.',
      }),
      retryOpts,
    );
    const criticOutput = parseCriticOutput(criticResponse.content);
    state.metadata.budgetRemaining -= criticResponse.usage.totalTokens;
    state.metadata.totalTokensUsed += criticResponse.usage.totalTokens;

    // 3. Adversary (if Policy decides)
    let adversaryOutput = null;
    if (decision.nextAction === 'attack') {
      const adversaryPrompt = buildAdversaryPrompt(state);
      const adversaryResponse = await retryWithBackoff(
        () => adapter.complete(adversaryPrompt, {
          model: config.model, systemPrompt: 'You are an adversary. Attack the reasoning.',
        }),
        retryOpts,
      );
      adversaryOutput = parseAdversaryOutput(adversaryResponse.content);
      state.metadata.budgetRemaining -= adversaryResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += adversaryResponse.usage.totalTokens;
    }

    // 4. Validator (no-op in MVP)
    const validatorResults = [await noopValidator.validate(state)];

    // 5. Transition
    const transitionInput: TransitionInput = {
      scratchpad: plannerResponse.content,
      stateFragment: stateFragment as Partial<ReasoningState>,
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
