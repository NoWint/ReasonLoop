/**
 * Team Debate Engine - Multi-agent adversarial reasoning through structured debate.
 *
 * Unlike multi-view (parallel independent analysis), team debate features:
 * - Agents see and respond to each other's arguments
 * - Structured rounds: opening → rebuttal → defense → synthesis
 * - Agents can challenge, support, or concede to other agents
 * - Final output includes consensus points AND irreconcilable conflicts
 */

import type {
  TeamAgent, AgentResponse, AgentChallenge, AgentStance,
  DebateRound, ConsensusPoint, IrreconcilableConflict, TeamDebateResult,
} from '../core/types.js';
import type { ModelAdapter, AdapterOptions } from './adapter.js';
import { retryWithBackoff } from '../core/retry.js';
import { v4 as uuid } from 'uuid';

// ─── Built-in Agent Presets ─────────────────────────────────────────

export const BUILT_IN_AGENTS: TeamAgent[] = [
  {
    id: 'architect',
    name: 'Architect',
    role: 'Systems Architect',
    systemPrompt: 'You are a senior systems architect. You think in terms of structure, modularity, scalability, and long-term maintainability. You prefer solutions that are elegant and well-organized. You challenge ideas that lack structural clarity or have hidden complexity.',
    personality: 'rigorous',
    expertise: ['architecture', 'design-patterns', 'scalability'],
  },
  {
    id: 'skeptic',
    name: 'Skeptic',
    role: 'Critical Analyst',
    systemPrompt: 'You are a professional skeptic. Your job is to find flaws, hidden assumptions, and overlooked risks. You do not accept claims without evidence. You challenge every assertion, especially those that seem obvious. You prefer to say "I disagree because..." rather than "That sounds right."',
    personality: 'skeptical',
    expertise: ['risk-analysis', 'logic', 'critical-thinking'],
  },
  {
    id: 'pragmatist',
    name: 'Pragmatist',
    role: 'Practical Engineer',
    systemPrompt: 'You are a pragmatic engineer who has shipped many production systems. You care about what actually works, not what looks good on paper. You challenge over-engineering, theoretical purity, and anything that cannot be implemented in a reasonable timeframe. You value simplicity and incremental progress.',
    personality: 'practical',
    expertise: ['engineering', 'implementation', 'operations'],
  },
  {
    id: 'innovator',
    name: 'Innovator',
    role: 'Creative Thinker',
    systemPrompt: 'You are a creative thinker who looks for unconventional solutions. You challenge the status quo and question why things must be done a certain way. You often propose alternatives that others have not considered. You value originality and are willing to take calculated risks.',
    personality: 'creative',
    expertise: ['innovation', 'lateral-thinking', 'emerging-tech'],
  },
];

// ─── Debate Callbacks ───────────────────────────────────────────────

export interface DebateCallbacks {
  onRoundStart?: (round: number, type: DebateRound['type']) => void;
  onAgentStart?: (agent: TeamAgent, round: number) => void;
  onAgentChunk?: (agentId: string, chunk: string) => void;
  onAgentComplete?: (agent: TeamAgent, response: AgentResponse, duration: number) => void;
  onRoundComplete?: (round: DebateRound) => void;
  onDebateComplete?: (result: TeamDebateResult) => void;
}

export interface DebateOptions {
  agents?: TeamAgent[];
  rounds?: number;                  // Total debate rounds (default: 3)
  callbacks?: DebateCallbacks;
  parallel?: boolean;               // Run agents in parallel within a round (default: true)
}

// ─── Prompt Builders ────────────────────────────────────────────────

function buildOpeningPrompt(agent: TeamAgent, goal: string): string {
  return `You are ${agent.name}, a ${agent.role}.

Your personality: ${agent.personality}
Your expertise: ${agent.expertise.join(', ')}

Your system guidance: ${agent.systemPrompt}

TOPIC: ${goal}

Provide your opening analysis. You MUST respond in the following structured format:

## My Position
[State your overall position on this topic]

## Claims
- [Claim 1]
- [Claim 2]
- [Claim 3]

## Stance
[support/oppose/neutral]

Be thorough, specific, and true to your role. Challenge assumptions where appropriate.`;
}

function buildRebuttalPrompt(
  agent: TeamAgent,
  goal: string,
  previousResponses: AgentResponse[],
  round: number,
): string {
  const otherResponses = previousResponses.filter(r => r.agentId !== agent.id);
  const othersText = otherResponses.map(r => {
    const otherAgent = r.agentId; // simplified
    return `--- ${otherAgent} (Round ${r.round}) ---
${r.content}`;
  }).join('\n\n');

  return `You are ${agent.name}, a ${agent.role}.

TOPIC: ${goal}

You are now in Round ${round} (REBUTTAL phase). You have seen the other agents' arguments below.

${othersText}

Now respond to the other agents. You MUST:
1. Directly challenge at least one claim from another agent (if you disagree)
2. Support at least one claim from another agent (if you agree)
3. Refine your own position based on what you've heard

Respond in this structured format:

## My Response
[Your rebuttal and refinements]

## Claims
- [Updated/new claims]

## Challenges
- TARGET: [agent-id] | CLAIM: [their claim] | COUNTER: [your counter-argument] | EVIDENCE: [supporting evidence] | SEVERITY: [minor/major/fatal]

## Stance
[support/oppose/neutral/concede]

Be direct and specific. Use "I challenge [agent]'s claim that..." or "I agree with [agent] that..."`;
}

function buildDefensePrompt(
  agent: TeamAgent,
  goal: string,
  challengesReceived: AgentChallenge[],
  allResponses: AgentResponse[],
  round: number,
): string {
  const myChallenges = challengesReceived.filter(c => c.targetAgentId === agent.id);
  const challengesText = myChallenges.length > 0
    ? myChallenges.map(c =>
        `CHALLENGE from ${c.targetAgentId} (severity: ${c.severity}):
  Their claim: "${c.targetClaim}"
  Their counter: ${c.counterArgument}
  Their evidence: ${c.evidence}`
      ).join('\n\n')
    : 'No direct challenges were raised against your position.';

  return `You are ${agent.name}, a ${agent.role}.

TOPIC: ${goal}

You are now in Round ${round} (DEFENSE phase). The following challenges were raised against your claims:

${challengesText}

You MUST respond to each challenge. For each:
- If the challenge has merit, CONCEDE and adjust your position
- If the challenge is flawed, DEFEND your position with evidence
- If the challenge reveals a gap, ACKNOWLEDGE and refine

Respond in this structured format:

## My Defense
[Your responses to each challenge]

## Claims
- [Updated claims after defense]

## Stance
[support/oppose/neutral/concede]

Be honest. Conceding a point is not weakness - it is intellectual rigor.`;
}

// ─── Response Parser ────────────────────────────────────────────────

function parseAgentResponse(raw: string, agentId: string, round: number): AgentResponse {
  const claims: string[] = [];
  const challenges: AgentChallenge[] = [];

  // Extract claims - support multiple formats
  const claimsSection = raw.match(/##\s*Claims?\s*\n([\s\S]*?)(?=\n##|\n*$)/i);
  if (claimsSection) {
    const lines = claimsSection[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*') || l.startsWith('1.') || l.startsWith('2.') || l.startsWith('3.'));
    for (const line of lines) {
      claims.push(line.replace(/^[-*\d.]\s*/, '').trim());
    }
  }

  // Fallback: extract any bullet points from the whole text
  if (claims.length === 0) {
    const bulletLines = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*'));
    for (const line of bulletLines.slice(0, 5)) {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 300) {
        claims.push(cleaned);
      }
    }
  }

  // Extract challenges - support multiple formats
  const challengeSection = raw.match(/##\s*Challenges?\s*\n([\s\S]*?)(?=\n##|\n*$)/i);
  if (challengeSection) {
    // Try structured format first
    const lines = challengeSection[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      const targetMatch = cleaned.match(/TARGET:\s*(\S+)/i);
      const claimMatch = cleaned.match(/CLAIM:\s*(.+?)(?=\s*\|\s*COUNTER:)/i);
      const counterMatch = cleaned.match(/COUNTER:\s*(.+?)(?=\s*\|\s*EVIDENCE:)/i);
      const evidenceMatch = cleaned.match(/EVIDENCE:\s*(.+?)(?=\s*\|\s*SEVERITY:)/i);
      const severityMatch = cleaned.match(/SEVERITY:\s*(minor|major|fatal)/i);

      if (targetMatch && counterMatch) {
        challenges.push({
          targetAgentId: targetMatch[1].trim(),
          targetClaim: claimMatch?.[1]?.trim() ?? '',
          counterArgument: counterMatch[1].trim(),
          evidence: evidenceMatch?.[1]?.trim() ?? '',
          severity: severityMatch?.[1] as AgentChallenge['severity'] ?? 'minor',
        });
      } else if (cleaned.length > 20) {
        // Unstructured challenge - try to extract target
        const targetAgent = BUILT_IN_AGENTS.find(a =>
          cleaned.toLowerCase().includes(a.name.toLowerCase()) || cleaned.includes(a.id)
        );
        if (targetAgent) {
          challenges.push({
            targetAgentId: targetAgent.id,
            targetClaim: '',
            counterArgument: cleaned,
            evidence: '',
            severity: 'minor',
          });
        }
      }
    }
  }

  // Extract stance - support multiple formats
  const stanceSection = raw.match(/##\s*Stance\s*\n\s*(support|oppose|neutral|concede)/i);
  let stance: AgentStance = 'neutral';
  if (stanceSection) {
    stance = stanceSection[1].toLowerCase() as AgentStance;
  } else {
    // Infer stance from content
    const lower = raw.toLowerCase();
    if (lower.includes('i oppose') || lower.includes('i disagree') || lower.includes('i am against')) {
      stance = 'oppose';
    } else if (lower.includes('i support') || lower.includes('i agree') || lower.includes('i am for')) {
      stance = 'support';
    } else if (lower.includes('i concede') || lower.includes('i yield') || lower.includes('you are right')) {
      stance = 'concede';
    }
  }

  return {
    agentId,
    round,
    content: raw,
    claims,
    challenges,
    stance,
  };
}

// ─── Consensus Analysis ─────────────────────────────────────────────

function analyzeConsensus(rounds: DebateRound[], agents: TeamAgent[]): {
  consensus: ConsensusPoint[];
  conflicts: IrreconcilableConflict[];
} {
  const allResponses = rounds.flatMap(r => r.responses);
  const consensus: ConsensusPoint[] = [];
  const conflicts: IrreconcilableConflict[] = [];

  // Group claims by similarity (simple keyword overlap)
  const allClaims = allResponses.flatMap(r =>
    r.claims.map(c => ({ agentId: r.agentId, claim: c, stance: r.stance }))
  );

  // Find claims that multiple agents agree on
  const processed = new Set<number>();
  for (let i = 0; i < allClaims.length; i++) {
    if (processed.has(i)) continue;
    const claim = allClaims[i];
    const agreeing: string[] = [claim.agentId];

    for (let j = i + 1; j < allClaims.length; j++) {
      if (processed.has(j)) continue;
      const other = allClaims[j];
      // Simple similarity: share significant keywords
      const words1 = new Set(claim.claim.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const words2 = new Set(other.claim.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const overlap = [...words1].filter(w => words2.has(w)).length;
      const union = new Set([...words1, ...words2]).size;
      const similarity = union > 0 ? overlap / union : 0;

      if (similarity > 0.3 && claim.stance !== 'oppose' && other.stance !== 'oppose') {
        agreeing.push(other.agentId);
        processed.add(j);
      }
    }
    processed.add(i);

    if (agreeing.length >= 2) {
      consensus.push({
        content: claim.claim,
        agreeingAgents: [...new Set(agreeing)],
        confidence: Math.min(agreeing.length / agents.length, 1),
      });
    }
  }

  // Find conflicts from challenges
  const allChallenges = allResponses.flatMap(r => r.challenges);
  const challengeGroups = new Map<string, AgentChallenge[]>();

  for (const ch of allChallenges) {
    const key = ch.targetClaim.slice(0, 50);
    const existing = challengeGroups.get(key) ?? [];
    existing.push(ch);
    challengeGroups.set(key, existing);
  }

  for (const [, group] of challengeGroups) {
    if (group.length > 0) {
      const targetResponse = allResponses.find(r =>
        r.claims.some(c => c.includes(group[0].targetClaim.slice(0, 30)))
      );
      if (targetResponse) {
        conflicts.push({
          description: group[0].targetClaim,
          positions: [
            {
              agentId: targetResponse.agentId,
              stance: 'original claim',
              reasoning: targetResponse.content.slice(0, 200),
            },
            ...group.map(ch => ({
              agentId: ch.targetAgentId,
              stance: `challenges (${ch.severity}): ${ch.counterArgument.slice(0, 100)}`,
              reasoning: ch.evidence,
            })),
          ],
        });
      }
    }
  }

  return { consensus, conflicts };
}

// ─── Main Debate Engine ─────────────────────────────────────────────

export async function runTeamDebate(
  goal: string,
  adapter: ModelAdapter,
  model: string,
  options?: DebateOptions,
): Promise<TeamDebateResult> {
  const agents = options?.agents ?? BUILT_IN_AGENTS;
  const totalRounds = options?.rounds ?? 3;
  const callbacks = options?.callbacks;
  const useParallel = options?.parallel ?? true;
  const startTime = Date.now();
  let totalTokens = 0;

  const rounds: DebateRound[] = [];
  const allResponses: AgentResponse[] = [];

  for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
    // Determine round type
    let roundType: DebateRound['type'];
    if (roundNum === 1) roundType = 'opening';
    else if (roundNum === totalRounds) roundType = 'synthesis';
    else if (roundNum % 2 === 0) roundType = 'rebuttal';
    else roundType = 'defense';

    callbacks?.onRoundStart?.(roundNum, roundType);
    const roundStart = Date.now();

    // Build prompts for each agent
    const agentPromises = agents.map(async (agent) => {
      callbacks?.onAgentStart?.(agent, roundNum);

      let prompt: string;
      if (roundType === 'opening') {
        prompt = buildOpeningPrompt(agent, goal);
      } else if (roundType === 'rebuttal') {
        prompt = buildRebuttalPrompt(agent, goal, allResponses, roundNum);
      } else if (roundType === 'defense') {
        const challengesReceived = allResponses.flatMap(r => r.challenges.filter(c => c.targetAgentId === agent.id));
        prompt = buildDefensePrompt(agent, goal, challengesReceived, allResponses, roundNum);
      } else {
        // synthesis round
        prompt = buildRebuttalPrompt(agent, goal, allResponses, roundNum) +
          '\n\nThis is the FINAL synthesis round. Try to find common ground and resolve remaining disagreements. If you cannot agree, clearly state why.';
      }

      const adapterOptions: AdapterOptions = {
        model,
        systemPrompt: agent.systemPrompt,
        temperature: 0.8,
        maxTokens: 2000,
      };

      const agentStart = Date.now();
      let content = '';

      if (adapter.streamComplete && callbacks?.onAgentChunk) {
        for await (const chunk of adapter.streamComplete(prompt, adapterOptions)) {
          content += chunk;
          callbacks.onAgentChunk(agent.id, chunk);
        }
        const tokens = Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4);
        totalTokens += tokens;
      } else {
        const result = await retryWithBackoff(
          () => adapter.complete(prompt, adapterOptions),
          { maxRetries: 2, baseDelay: 1000 },
        );
        content = result.content;
        totalTokens += result.usage.totalTokens;
      }

      const response = parseAgentResponse(content, agent.id, roundNum);
      const duration = Date.now() - agentStart;
      callbacks?.onAgentComplete?.(agent, response, duration);

      return response;
    });

    // Execute agents
    let roundResponses: AgentResponse[];
    if (useParallel) {
      roundResponses = await Promise.all(agentPromises);
    } else {
      roundResponses = [];
      for (const p of agentPromises) {
        roundResponses.push(await p);
      }
    }

    allResponses.push(...roundResponses);

    const round: DebateRound = {
      round: roundNum,
      type: roundType,
      responses: roundResponses,
      duration: Date.now() - roundStart,
    };
    rounds.push(round);
    callbacks?.onRoundComplete?.(round);
  }

  // Analyze consensus and conflicts
  const { consensus, conflicts } = analyzeConsensus(rounds, agents);

  // Build final synthesis from last round
  const lastRound = rounds[rounds.length - 1];
  const finalSynthesis = lastRound.responses.map(r => {
    const agent = agents.find(a => a.id === r.agentId);
    return `## ${agent?.name ?? r.agentId} (Final Position)\n${r.content}`;
  }).join('\n\n---\n\n');

  const result: TeamDebateResult = {
    goal,
    agents,
    rounds,
    consensus,
    conflicts,
    finalSynthesis,
    totalTokens,
    totalDuration: Date.now() - startTime,
  };

  callbacks?.onDebateComplete?.(result);
  return result;
}
