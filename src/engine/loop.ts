import type { ReasoningState, ServerConfig, TransitionInput, ReasoningView, SynthesisResult, CriticOutput, PolicyDecision } from '../core/types.js';
import type { ModelAdapter, AdapterOptions, AdapterResponse } from './adapter.js';
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
import { compileStateForView } from '../core/compiler.js';
import { BUILT_IN_VIEWS } from '../core/views.js';
import { synthesizeViews } from '../core/synthesizer.js';

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
  onCriticChunk?: (chunk: string) => void;
  onCriticComplete?: (output: CriticOutput, rawContent: string, duration: number) => void;
  onAdversaryStart?: () => void;
  onAdversaryChunk?: (chunk: string) => void;
  onAdversaryComplete?: (output: CriticOutput, rawContent: string, duration: number) => void;
  onIterationComplete?: (state: ReasoningState, decision: PolicyDecision) => void;
}

export interface LoopOptions {
  multiView?: {
    enabled: boolean;
    views?: ReasoningView[];
  };
  callbacks?: LoopCallbacks;
  /** Run all 4 roles in parallel each iteration (default: true) */
  parallel?: boolean;
}

// Helper to run a step with optional streaming and callbacks
async function runStep(
  adapter: ModelAdapter,
  prompt: string,
  options: AdapterOptions,
  onStart?: () => void,
  onChunk?: (chunk: string) => void,
): Promise<AdapterResponse> {
  onStart?.();

  if (adapter.streamComplete && onChunk) {
    let content = '';
    for await (const chunk of adapter.streamComplete(prompt, options)) {
      content += chunk;
      onChunk(chunk);
    }
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(content.length / 4);
    return { content, usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } };
  }

  const result = await adapter.complete(prompt, options);
  return result;
}

export async function runLoop(
  goal: string,
  sessionId: string,
  config: ServerConfig,
  adapter: ModelAdapter,
  options?: LoopOptions,
): Promise<{ finalState: ReasoningState; history: ReasoningState[] }> {
  let state = initState(goal, sessionId, config.budget);
  const history: ReasoningState[] = [state];
  const callbacks = options?.callbacks;
  const useParallel = options?.parallel ?? true;

  const convergenceConfig = {
    maxIterations: config.maxIterations,
    budgetLimit: config.budget,
    stabilityThreshold: config.stabilityThreshold,
    minIterations: config.minIterations,
    complexityThreshold: config.complexityThreshold,
  };

  const retryOpts = { maxRetries: 3, baseDelay: 1000 };
  const startTime = Date.now();
  const useMultiView = options?.multiView?.enabled ?? false;
  const views = options?.multiView?.views ?? BUILT_IN_VIEWS;

  while (true) {
    if (Date.now() - startTime > config.loopTimeoutMs) break;

    const decision = decide(state, convergenceConfig);
    if (decision.nextAction === 'stop') break;

    if (useMultiView && views.length > 1) {
      // ========== MULTI-VIEW MODE ==========
      // Run all views in parallel, each acting as a full reasoning role
      const viewPromises = views.map(async (view) => {
        const viewPrompt = compileStateForView(state, decision.nextAction, view);
        const viewStepStart = Date.now();
        const viewResponse = await retryWithBackoff(
          () => runStep(
            adapter,
            viewPrompt.user,
            { model: config.model, systemPrompt: viewPrompt.system },
            () => callbacks?.onViewStart?.(view),
            (chunk) => callbacks?.onViewChunk?.(view, chunk),
          ),
          retryOpts,
        );
        callbacks?.onViewComplete?.(view, viewResponse.content, Date.now() - viewStepStart);
        return { view, content: viewResponse.content, usage: viewResponse.usage };
      });

      const viewResults = await Promise.all(viewPromises);

      for (const vr of viewResults) {
        state.metadata.budgetRemaining -= vr.usage.totalTokens;
        state.metadata.totalTokensUsed += vr.usage.totalTokens;
      }

      const viewStates = viewResults.map(vr => ({
        view: vr.view,
        state: {
          ...state,
          claims: extractStateFragment(vr.content, state.iteration + 1).claims.map((c, i) => ({
            ...c,
            id: `claim-${vr.view.id}-${state.iteration + 1}-${i}`,
            source: 'planner' as const,
          })),
          assumptions: extractStateFragment(vr.content, state.iteration + 1).assumptions.map((a, i) => ({
            ...a,
            id: `assumption-${vr.view.id}-${state.iteration + 1}-${i}`,
          })),
        } as ReasoningState,
      }));

      const synthesis = synthesizeViews(viewStates);
      callbacks?.onSynthesisComplete?.(synthesis);

      const plannerContent = viewResults.map(vr => `## ${vr.view.name}\n${vr.content}`).join('\n\n---\n\n');
      const stateFragment = {
        claims: synthesis.synthesized.claims,
        assumptions: synthesis.synthesized.assumptions,
        evidence: synthesis.synthesized.evidence,
        openQuestions: synthesis.synthesized.openQuestions,
      };

      // After multi-view, run critic and adversary sequentially
      const criticPrompt = buildCriticPrompt(state);
      const criticStepStart = Date.now();
      callbacks?.onCriticStart?.();
      const criticResponse = await retryWithBackoff(
        () => runStep(adapter, criticPrompt, {
          model: config.model, systemPrompt: 'You are a critical reasoning evaluator.',
        }, undefined, callbacks?.onCriticChunk),
        retryOpts,
      );
      const criticOutput = parseCriticOutput(criticResponse.content);
      callbacks?.onCriticComplete?.(criticOutput, criticResponse.content, Date.now() - criticStepStart);
      state.metadata.budgetRemaining -= criticResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += criticResponse.usage.totalTokens;

      let adversaryOutput = null;
      if (decision.nextAction === 'attack') {
        const adversaryPrompt = buildAdversaryPrompt(state);
        const adversaryStepStart = Date.now();
        callbacks?.onAdversaryStart?.();
        const adversaryResponse = await retryWithBackoff(
          () => runStep(adapter, adversaryPrompt, {
            model: config.model, systemPrompt: 'You are an adversary. Attack the reasoning.',
          }, undefined, callbacks?.onAdversaryChunk),
          retryOpts,
        );
        adversaryOutput = parseAdversaryOutput(adversaryResponse.content);
        callbacks?.onAdversaryComplete?.(adversaryOutput, adversaryResponse.content, Date.now() - adversaryStepStart);
        state.metadata.budgetRemaining -= adversaryResponse.usage.totalTokens;
        state.metadata.totalTokensUsed += adversaryResponse.usage.totalTokens;
      }

      const validatorResults = [await noopValidator.validate(state)];
      const transitionInput: TransitionInput = {
        scratchpad: plannerContent,
        stateFragment: stateFragment as Partial<ReasoningState>,
        critic: criticOutput,
        adversary: adversaryOutput,
        validatorResults,
      };
      state = transition(state, transitionInput, decision.nextAction);

    } else if (useParallel) {
      // ========== PARALLEL MODE: all 4 roles think simultaneously ==========
      // Build all prompts first
      const scratchpadPrompt = buildScratchpadPrompt(state, decision.nextAction);
      const plannerPrompt = buildPlannerPrompt(state, decision.nextAction, ''); // no scratchpad context in parallel mode
      const criticPrompt = buildCriticPrompt(state);
      const shouldAttack = decision.nextAction === 'attack';
      const adversaryPrompt = shouldAttack ? buildAdversaryPrompt(state) : null;

      // Fire all requests simultaneously
      const parallelStart = Date.now();

      const scratchpadPromise = retryWithBackoff(
        () => runStep(
          adapter, scratchpadPrompt,
          { model: config.model, systemPrompt: 'You are a free-thinking explorer. No structure, just explore.' },
          callbacks?.onScratchpadStart, callbacks?.onScratchpadChunk,
        ), retryOpts,
      );

      const plannerPromise = retryWithBackoff(
        () => runStep(
          adapter, plannerPrompt.user,
          { model: config.model, systemPrompt: plannerPrompt.system },
          callbacks?.onPlannerStart, callbacks?.onPlannerChunk,
        ), retryOpts,
      );

      const criticPromise = retryWithBackoff(
        () => runStep(
          adapter, criticPrompt,
          { model: config.model, systemPrompt: 'You are a critical reasoning evaluator.' },
          callbacks?.onCriticStart, callbacks?.onCriticChunk,
        ), retryOpts,
      );

      const adversaryPromise = shouldAttack
        ? retryWithBackoff(
            () => runStep(
              adapter, adversaryPrompt!,
              { model: config.model, systemPrompt: 'You are an adversary. Attack the reasoning.' },
              callbacks?.onAdversaryStart, callbacks?.onAdversaryChunk,
            ), retryOpts,
          )
        : Promise.resolve(null);

      // Wait for all to complete
      const [scratchpadResponse, plannerResponse, criticResponse, adversaryResponse] = await Promise.all([
        scratchpadPromise, plannerPromise, criticPromise, adversaryPromise,
      ]);

      // Fire completion callbacks with durations
      callbacks?.onScratchpadComplete?.(scratchpadResponse.content, Date.now() - parallelStart);
      callbacks?.onPlannerComplete?.(plannerResponse.content, Date.now() - parallelStart);

      const criticOutput = parseCriticOutput(criticResponse.content);
      callbacks?.onCriticComplete?.(criticOutput, criticResponse.content, Date.now() - parallelStart);

      let adversaryOutput = null;
      if (adversaryResponse) {
        adversaryOutput = parseAdversaryOutput(adversaryResponse.content);
        callbacks?.onAdversaryComplete?.(adversaryOutput, adversaryResponse.content, Date.now() - parallelStart);
        state.metadata.budgetRemaining -= adversaryResponse.usage.totalTokens;
        state.metadata.totalTokensUsed += adversaryResponse.usage.totalTokens;
      }

      // Track token usage
      state.metadata.budgetRemaining -= scratchpadResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += scratchpadResponse.usage.totalTokens;
      state.metadata.budgetRemaining -= plannerResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += plannerResponse.usage.totalTokens;
      state.metadata.budgetRemaining -= criticResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += criticResponse.usage.totalTokens;

      // Transition
      const stateFragment = extractStateFragment(plannerResponse.content, state.iteration + 1);
      const validatorResults = [await noopValidator.validate(state)];
      const transitionInput: TransitionInput = {
        scratchpad: scratchpadResponse.content,
        stateFragment: stateFragment as Partial<ReasoningState>,
        critic: criticOutput,
        adversary: adversaryOutput,
        validatorResults,
      };
      state = transition(state, transitionInput, decision.nextAction);

    } else {
      // ========== SEQUENTIAL MODE: original behavior ==========
      // 0. Scratchpad
      const scratchpadPrompt = buildScratchpadPrompt(state, decision.nextAction);
      const scratchpadStepStart = Date.now();
      const scratchpadResponse = await retryWithBackoff(
        () => runStep(
          adapter, scratchpadPrompt,
          { model: config.model, systemPrompt: 'You are a free-thinking explorer. No structure, just explore.' },
          callbacks?.onScratchpadStart, callbacks?.onScratchpadChunk,
        ), retryOpts,
      );
      callbacks?.onScratchpadComplete?.(scratchpadResponse.content, Date.now() - scratchpadStepStart);
      state.metadata.budgetRemaining -= scratchpadResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += scratchpadResponse.usage.totalTokens;

      // 1. Planner
      const plannerPrompt = buildPlannerPrompt(state, decision.nextAction, scratchpadResponse.content);
      const plannerStepStart = Date.now();
      const plannerResponse = await retryWithBackoff(
        () => runStep(
          adapter, plannerPrompt.user,
          { model: config.model, systemPrompt: plannerPrompt.system },
          callbacks?.onPlannerStart, callbacks?.onPlannerChunk,
        ), retryOpts,
      );
      callbacks?.onPlannerComplete?.(plannerResponse.content, Date.now() - plannerStepStart);
      state.metadata.budgetRemaining -= plannerResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += plannerResponse.usage.totalTokens;

      const plannerContent = plannerResponse.content;
      const stateFragment = extractStateFragment(plannerResponse.content, state.iteration + 1);

      // 2. Critic
      const criticPrompt = buildCriticPrompt(state);
      const criticStepStart = Date.now();
      callbacks?.onCriticStart?.();
      const criticResponse = await retryWithBackoff(
        () => adapter.complete(criticPrompt, {
          model: config.model, systemPrompt: 'You are a critical reasoning evaluator.',
        }), retryOpts,
      );
      const criticOutput = parseCriticOutput(criticResponse.content);
      callbacks?.onCriticComplete?.(criticOutput, criticResponse.content, Date.now() - criticStepStart);
      state.metadata.budgetRemaining -= criticResponse.usage.totalTokens;
      state.metadata.totalTokensUsed += criticResponse.usage.totalTokens;

      // 3. Adversary
      let adversaryOutput = null;
      if (decision.nextAction === 'attack') {
        const adversaryPrompt = buildAdversaryPrompt(state);
        const adversaryStepStart = Date.now();
        callbacks?.onAdversaryStart?.();
        const adversaryResponse = await retryWithBackoff(
          () => adapter.complete(adversaryPrompt, {
            model: config.model, systemPrompt: 'You are an adversary. Attack the reasoning.',
          }), retryOpts,
        );
        adversaryOutput = parseAdversaryOutput(adversaryResponse.content);
        callbacks?.onAdversaryComplete?.(adversaryOutput, adversaryResponse.content, Date.now() - adversaryStepStart);
        state.metadata.budgetRemaining -= adversaryResponse.usage.totalTokens;
        state.metadata.totalTokensUsed += adversaryResponse.usage.totalTokens;
      }

      // 4. Validator
      const validatorResults = [await noopValidator.validate(state)];

      // 5. Transition
      const transitionInput: TransitionInput = {
        scratchpad: plannerContent,
        stateFragment: stateFragment as Partial<ReasoningState>,
        critic: criticOutput,
        adversary: adversaryOutput,
        validatorResults,
      };
      state = transition(state, transitionInput, decision.nextAction);
    }

    history.push(state);
    try { await saveState(state, config.outputDir); } catch { /* ignore storage errors */ }

    callbacks?.onIterationComplete?.(state, decision);

    if (checkConvergence(state, convergenceConfig)) break;
  }

  return { finalState: state, history };
}
