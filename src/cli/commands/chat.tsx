import type { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App, type ChatState, type ReasoningEvent } from '../tui/app.js';
import { loadUserConfig } from '../setup/provider.js';
import { createAdapter } from '../../engine/adapter.js';
import { loadConfig, type ReasonLoopConfig } from '../../config/index.js';
import { analyzeComplexity } from '../../core/complexity.js';
import { runLoop, type LoopCallbacks } from '../../engine/loop.js';
import { runTeamDebate, BUILT_IN_AGENTS, type DebateCallbacks } from '../../engine/team-debate.js';
import { compileFinalResponse } from '../../core/compiler.js';
import type { ServerConfig, TeamAgent } from '../../core/types.js';
import { v4 as uuid } from 'uuid';

function mapToServerConfig(cfg: ReasonLoopConfig, apiKey: string, multiViewEnabled: boolean): ServerConfig {
  const provider: 'openai' | 'claude' = cfg.models.providers?.anthropic?.apiKey ? 'claude' : 'openai';
  return {
    port: cfg.server.port,
    provider,
    model: cfg.models.default,
    apiKey,
    baseUrl: provider === 'openai'
      ? cfg.models.providers?.openai?.baseUrl
      : cfg.models.providers?.anthropic?.baseUrl,
    maxIterations: cfg.convergence.maxIterations,
    budget: cfg.convergence.budgetLimit,
    stabilityThreshold: cfg.convergence.stabilityThreshold,
    minIterations: cfg.convergence.minIterations,
    complexityThreshold: cfg.convergence.complexityThreshold,
    outputDir: cfg.storage.path,
    loopTimeoutMs: cfg.loop.timeout,
    multiView: {
      enabled: multiViewEnabled || cfg.multiView.enabled,
      views: cfg.multiView.views.length > 0 ? cfg.multiView.views : undefined,
    },
  };
}

const IDLE_ROLE = { status: 'idle' as const, content: '' };

function makeInitialState(overrides: Partial<ChatState> = {}): ChatState {
  return {
    provider: 'openai',
    model: 'gpt-4',
    multiView: false,
    debateMode: false,
    maxIterations: 10,
    budget: 100000,
    currentIteration: 0,
    stability: 0,
    usedBudget: 0,
    isReasoning: false,
    events: [],
    serveMode: false,
    roles: {
      scratchpad: { ...IDLE_ROLE },
      planner: { ...IDLE_ROLE },
      critic: { ...IDLE_ROLE },
      adversary: { ...IDLE_ROLE },
    },
    views: [],
    synthesis: null,
    iterationInfo: '',
    finalAnswer: '',
    ...overrides,
  };
}

export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('Interactive reasoning chat with TUI')
    .option('--provider <provider>', 'LLM provider (openai or claude)')
    .option('--model <model>', 'Model name')
    .option('--base-url <url>', 'API base URL')
    .option('--multi-view', 'Enable multi-view reasoning')
    .option('--max-iterations <n>', 'Max reasoning iterations', parseInt)
    .option('--budget <n>', 'Token budget', parseInt)
    .option('--serve', 'Also start proxy server')
    .option('--force-loop', 'Always trigger reasoning loop (skip complexity check)')
    .option('--complexity-threshold <n>', 'Complexity threshold for looping (default: 0.3)', parseFloat)
    .option('--debate', 'Use team debate mode (multi-agent adversarial)')
    .option('--debate-rounds <n>', 'Number of debate rounds (default: 3)', parseInt)
    .action(async (options: Record<string, unknown>) => {
      // Load config: user config file < env vars < CLI args
      const userConfig = loadUserConfig();
      const provider = (options.provider as string) ?? userConfig?.provider ?? 'openai';
      const model = (options.model as string) ?? userConfig?.model ?? 'gpt-4';
      const baseUrl = (options.baseUrl as string) ?? userConfig?.baseUrl;
      const apiKey = userConfig?.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
      const multiView = (options.multiView as boolean) ?? userConfig?.multiView ?? false;
      const maxIterations = (options.maxIterations as number) ?? userConfig?.maxIterations ?? 10;
      const budget = (options.budget as number) ?? userConfig?.budget ?? 100000;

      if (!apiKey) {
        console.error('No API key found. Run `reasonloop setup` first or set OPENAI_API_KEY env var.');
        process.exit(1);
      }

      // Build config overrides
      const overrides: Record<string, unknown> = {};
      overrides.models = {
        default: model,
        providers: {
          ...(provider === 'claude'
            ? { anthropic: { apiKey, baseUrl } }
            : { openai: { apiKey, baseUrl } }),
        },
      };
      overrides.convergence = { maxIterations, budgetLimit: budget };
      overrides.multiView = { enabled: multiView };

      const cfg = loadConfig(overrides as Partial<ReasonLoopConfig>);
      const serverConfig = mapToServerConfig(cfg, apiKey, multiView);

      // Create adapter
      const adapter = createAdapter(provider === 'claude' ? 'claude' : 'openai', {
        apiKey,
        baseUrl,
      });

      // Initial state
      let currentChatState: ChatState = makeInitialState({
        provider,
        model,
        multiView,
        maxIterations,
        budget,
        serveMode: !!options.serve,
      });

      function updateState(updater: (prev: ChatState) => ChatState) {
        currentChatState = updater(currentChatState);
        rerender(
          <App state={currentChatState} onSendMessage={handleSendMessage} />
        );
      }

      function resetRoles(): ChatState['roles'] {
        return {
          scratchpad: { ...IDLE_ROLE },
          planner: { ...IDLE_ROLE },
          critic: { ...IDLE_ROLE },
          adversary: { ...IDLE_ROLE },
        };
      }

      async function processMessage(message: string) {
        // Add user message, reset roles for new reasoning
        updateState(s => ({
          ...s,
          isReasoning: true,
          events: [...s.events, { type: 'system' as const, content: `> ${message}` }],
          roles: resetRoles(),
          views: [],
          synthesis: null,
          iterationInfo: '',
          finalAnswer: '',
        }));

        try {
          // Check if debate mode is active
          const useDebate = options.debate === true || currentChatState.debateMode;

          if (useDebate) {
            // ── Team Debate Mode ──
            updateState(s => ({
              ...s,
              events: [...s.events, { type: 'system' as const, content: `Team Debate: ${BUILT_IN_AGENTS.length} agents, ${(options.debateRounds as number) ?? 3} rounds` }],
              views: BUILT_IN_AGENTS.map(a => ({
                name: a.name,
                color: ({ Architect: 'blue', Skeptic: 'red', Pragmatist: 'yellow', Innovator: 'green' } as Record<string, string>)[a.name] ?? 'cyan',
                status: 'idle' as const,
                content: '',
              })),
            }));

            const debateCallbacks: DebateCallbacks = {
              onRoundStart: (round, type) => {
                updateState(s => ({
                  ...s,
                  iterationInfo: `-- Round ${round}/${(options.debateRounds as number) ?? 3} | ${type.toUpperCase()} --`,
                }));
              },
              onAgentStart: (agent, round) => {
                updateState(s => {
                  const views = s.views.map(v =>
                    v.name === agent.name ? { ...v, status: 'thinking' as const, content: '' } : v
                  );
                  return { ...s, views };
                });
              },
              onAgentChunk: (agentId, chunk) => {
                updateState(s => {
                  const agent = BUILT_IN_AGENTS.find(a => a.id === agentId);
                  if (!agent) return s;
                  const views = s.views.map(v =>
                    v.name === agent.name ? { ...v, content: v.content + chunk } : v
                  );
                  return { ...s, views };
                });
              },
              onAgentComplete: (agent, response, duration) => {
                updateState(s => {
                  const views = s.views.map(v =>
                    v.name === agent.name ? { ...v, status: 'done' as const, duration } : v
                  );
                  return { ...s, views };
                });
              },
            };

            const debateResult = await runTeamDebate(message, adapter, currentChatState.model, {
              rounds: (options.debateRounds as number) ?? 3,
              callbacks: debateCallbacks,
              parallel: true,
            });

            // Build final answer
            const consensusText = debateResult.consensus.length > 0
              ? debateResult.consensus.map(c => `- ${c.content} (${c.agreeingAgents.length} agree, ${(c.confidence * 100).toFixed(0)}%)`).join('\n')
              : 'No consensus reached.';
            const conflictText = debateResult.conflicts.length > 0
              ? debateResult.conflicts.map(c => `- ${c.description}`).join('\n')
              : 'No irreconcilable conflicts.';

            updateState(s => ({
              ...s,
              isReasoning: false,
              finalAnswer: `# Consensus\n${consensusText}\n\n# Conflicts\n${conflictText}\n\n# Full Debate\n${debateResult.finalSynthesis}`,
              synthesis: { content: `${debateResult.consensus.length} consensus | ${debateResult.conflicts.length} conflicts` },
            }));
          } else {
            // ── Standard Reasoning Mode ──
            // Analyze complexity
            const complexityInput = {
              model: currentChatState.model,
              messages: [{ role: 'user', content: message }],
            };
            const forceLoop = options.forceLoop === true;
            const threshold = (options.complexityThreshold as number) ?? 0.3;
            const complexity = analyzeComplexity(complexityInput, threshold);

            if (!forceLoop && !complexity.shouldLoop) {
              // Low complexity - direct call
              updateState(s => ({
                ...s,
                events: [...s.events, { type: 'system' as const, content: `Complexity: ${complexity.score.toFixed(2)} - direct response` }],
              }));

              const result = await adapter.complete(message, {
                model: currentChatState.model,
                systemPrompt: 'You are a helpful assistant.',
                temperature: 0.7,
                maxTokens: 2000,
              });

              updateState(s => ({
                ...s,
                isReasoning: false,
                finalAnswer: result.content,
              }));
            } else {
              // High complexity - run reasoning loop
              updateState(s => ({
                ...s,
                events: [...s.events, { type: 'system' as const, content: `Complexity: ${complexity.score.toFixed(2)} - reasoning loop` }],
              }));

              const sessionId = uuid();

              // Track streaming content per role
              let scratchpadContent = '';
              let plannerContent = '';

              const callbacks: LoopCallbacks = {
                onScratchpadStart: () => {
                  scratchpadContent = '';
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, scratchpad: { status: 'thinking', content: '' } },
                  }));
                },
                onScratchpadChunk: (chunk) => {
                  scratchpadContent += chunk;
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, scratchpad: { status: 'thinking', content: scratchpadContent } },
                  }));
                },
                onScratchpadComplete: (_content, duration) => {
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, scratchpad: { status: 'done', content: scratchpadContent, duration } },
                  }));
                },
                onPlannerStart: () => {
                  plannerContent = '';
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, planner: { status: 'thinking', content: '' } },
                  }));
                },
                onPlannerChunk: (chunk) => {
                  plannerContent += chunk;
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, planner: { status: 'thinking', content: plannerContent } },
                  }));
                },
                onPlannerComplete: (_content, duration) => {
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, planner: { status: 'done', content: plannerContent, duration } },
                  }));
                },
                onViewStart: (view) => {
                  updateState(s => {
                    const views = [...s.views];
                    const existing = views.find(v => v.name === view.name);
                    if (existing) {
                      existing.status = 'thinking';
                      existing.content = '';
                    } else {
                      const color = ({ Architect: 'blue', 'Security Engineer': 'magenta', DevOps: 'green', Pragmatist: 'yellow' } as Record<string, string>)[view.name] ?? 'blue';
                      views.push({ name: view.name, color, status: 'thinking', content: '' });
                    }
                    return { ...s, views };
                  });
                },
                onViewChunk: (view, chunk) => {
                  updateState(s => {
                    const views = s.views.map(v =>
                      v.name === view.name ? { ...v, content: v.content + chunk } : v
                    );
                    return { ...s, views };
                  });
                },
                onViewComplete: (view, _content, duration) => {
                  updateState(s => {
                    const views = s.views.map(v =>
                      v.name === view.name ? { ...v, status: 'done' as const, duration } : v
                    );
                    return { ...s, views };
                  });
                },
                onSynthesisComplete: (result) => {
                  const consensusStr = result.consensus.map(c => c.content).join('\n');
                  const conflictStr = result.conflicts.map(c => `${c.positions.join(' vs ')}: ${c.description}`).join('\n');
                  updateState(s => ({
                    ...s,
                    synthesis: { content: `${result.consensus.length} consensus | ${result.conflicts.length} conflict\n${consensusStr}\n${conflictStr}` },
                  }));
                },
                onCriticStart: () => {
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, critic: { status: 'thinking', content: '' } },
                  }));
                },
                onCriticChunk: (chunk) => {
                  updateState(s => {
                    const prev = s.roles.critic.content;
                    return { ...s, roles: { ...s.roles, critic: { status: 'thinking', content: prev + chunk } } };
                  });
                },
                onCriticComplete: (output, rawContent, duration) => {
                  const issues = (output.issues ?? []).map(i => `ISSUE: ${i}`).join('\n');
                  const risks = (output.risks ?? []).map(r => `RISK: ${r}`).join('\n');
                  const suggestions = (output.suggestions ?? []).map(si => `SUGGESTION: ${si}`).join('\n');
                  const structured = [issues, risks, suggestions].filter(Boolean).join('\n');
                  const content = rawContent + '\n---\n' + structured;
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, critic: { status: 'done', content, duration } },
                  }));
                },
                onAdversaryStart: () => {
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, adversary: { status: 'thinking', content: '' } },
                  }));
                },
                onAdversaryChunk: (chunk) => {
                  updateState(s => {
                    const prev = s.roles.adversary.content;
                    return { ...s, roles: { ...s.roles, adversary: { status: 'thinking', content: prev + chunk } } };
                  });
                },
                onAdversaryComplete: (output, rawContent, duration) => {
                  const attacks = (output.issues ?? []).map(a => `ATTACK: ${a}`).join('\n');
                  const content = rawContent + '\n---\n' + attacks;
                  updateState(s => ({
                    ...s,
                    roles: { ...s.roles, adversary: { status: 'done', content, duration } },
                  }));
                },
                onIterationComplete: (state, decision) => {
                  const iter = currentChatState.currentIteration + 1;
                  updateState(s => ({
                    ...s,
                    currentIteration: iter,
                    stability: state.metadata.stability,
                    usedBudget: state.metadata.totalTokensUsed,
                    iterationInfo: `-- Iteration ${iter} | stability: ${state.metadata.stability.toFixed(2)} | next: ${decision.nextAction} --`,
                    roles: resetRoles(),
                  }));
                },
              };

              const { finalState } = await runLoop(message, sessionId, serverConfig, adapter, {
                multiView: { enabled: currentChatState.multiView },
                callbacks,
              });

              const finalResponse = compileFinalResponse(finalState, []);
              updateState(s => ({
                ...s,
                isReasoning: false,
                finalAnswer: finalResponse,
              }));
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          updateState(s => ({
            ...s,
            isReasoning: false,
            events: [...s.events, { type: 'error', content: msg }],
          }));
        }
      }

      function handleSendMessage(message: string) {
        // Handle chat commands
        if (message.startsWith('/')) {
          const [cmd, ...args] = message.slice(1).split(' ');
          switch (cmd) {
            case 'clear':
              updateState(s => ({ ...s, events: [], finalAnswer: '', iterationInfo: '', roles: resetRoles(), views: [], synthesis: null }));
              break;
            case 'multi-view':
              updateState(s => ({ ...s, multiView: !s.multiView }));
              break;
            case 'debate':
              updateState(s => ({ ...s, debateMode: !s.debateMode }));
              break;
            case 'config':
              updateState(s => ({
                ...s,
                events: [...s.events, {
                  type: 'system',
                  content: `Provider: ${s.provider}\nModel: ${s.model}\nMulti-view: ${s.multiView}\nDebate: ${s.debateMode}\nMax iterations: ${s.maxIterations}\nBudget: ${s.budget}`,
                }],
              }));
              break;
            case 'model':
              if (args[0]) updateState(s => ({ ...s, model: args[0] }));
              break;
            case 'max-iter':
              if (args[0]) updateState(s => ({ ...s, maxIterations: parseInt(args[0]) }));
              break;
            case 'budget':
              if (args[0]) updateState(s => ({ ...s, budget: parseInt(args[0]) }));
              break;
            case 'serve':
              updateState(s => ({ ...s, serveMode: !s.serveMode }));
              break;
            case 'help':
              updateState(s => ({
                ...s,
                events: [...s.events, {
                  type: 'system',
                  content: 'Commands: /multi-view, /debate, /config, /model <name>, /max-iter <n>, /budget <n>, /serve, /clear, /help, /exit',
                }],
              }));
              break;
            default:
              updateState(s => ({
                ...s,
                events: [...s.events, {
                  type: 'system',
                  content: `Unknown command: /${cmd}. Type /help for available commands.`,
                }],
              }));
          }
          return;
        }

        // Process message asynchronously
        processMessage(message);
      }

      // Render Ink TUI
      const { rerender } = render(
        <App state={currentChatState} onSendMessage={handleSendMessage} />
      );

      // Handle --serve mode
      if (options.serve) {
        const { startServer } = await import('../../gateway/server.js');
        await startServer(serverConfig);
        updateState(s => ({
          ...s,
          events: [...s.events, { type: 'system', content: `Proxy server started on port ${serverConfig.port}` }],
        }));
      }
    });
}
