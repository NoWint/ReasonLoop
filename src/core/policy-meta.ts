import type { ReasoningState, PolicyDecision, ConvergenceConfig, Decision } from './types.js';
import type { ModelAdapter, AdapterOptions } from '../engine/adapter.js';

export interface Policy {
  decide(state: ReasoningState, config: ConvergenceConfig): Promise<PolicyDecision>;
}

export class MetaReasoningPolicy implements Policy {
  constructor(
    private adapter: ModelAdapter,
    private model: string,
  ) {}

  async decide(state: ReasoningState, config: ConvergenceConfig): Promise<PolicyDecision> {
    const prompt = this.buildPrompt(state, config);
    const options: AdapterOptions = {
      model: this.model,
      temperature: 0,
      maxTokens: 500,
      systemPrompt: 'You are a reasoning policy controller. Respond with exactly one word: expand, refine, verify, attack, or stop.',
    };
    const response = await this.adapter.complete(prompt, options);
    const { nextAction, reasoning } = this.parseDecision(response.content);
    return {
      nextAction,
      reasoning: reasoning + ' (meta-reasoning)',
      estimatedGain: 0,
      estimatedCost: 0,
    };
  }

  buildPrompt(state: ReasoningState, _config: ConvergenceConfig): string {
    const lines: string[] = [
      'Decide the next reasoning action for this state.',
      '',
      `Goal: ${state.goal}`,
      `Iteration: ${state.iteration}`,
      `Stability: ${state.metadata.stability.toFixed(2)}`,
      `Budget remaining: ${state.metadata.budgetRemaining}`,
      `Claims: ${state.claims.length}`,
      `Open questions: ${state.openQuestions.length}`,
      `Controversies: ${state.controversies.filter(c => !c.resolved).length}`,
      `Unverified assumptions: ${state.assumptions.filter(a => a.status === 'unverified').length}`,
      '',
      'Choose one: expand, refine, verify, attack, stop',
    ];
    return lines.join('\n');
  }

  parseDecision(text: string): { nextAction: Decision; reasoning: string } {
    const valid: Decision[] = ['expand', 'refine', 'verify', 'attack', 'stop'];
    const lower = text.trim().toLowerCase();
    for (const d of valid) {
      if (lower.includes(d)) {
        return { nextAction: d, reasoning: `Meta-reasoning selected: ${d}` };
      }
    }
    return { nextAction: 'refine', reasoning: 'Defaulting to refine: could not parse meta-reasoning output' };
  }
}
