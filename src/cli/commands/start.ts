import type { Command } from 'commander';
import { startServer } from '../../gateway/server.js';
import type { ServerConfig } from '../../core/types.js';
import { loadConfig } from '../../config/index.js';
import type { ReasonLoopConfig } from '../../config/index.js';

function mapToServerConfig(cfg: ReasonLoopConfig, apiKey: string): ServerConfig {
  const provider = cfg.models.providers?.anthropic?.apiKey ? 'claude' : 'openai';
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
  };
}

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the ReasonLoop proxy server')
    .option('-p, --port <port>', 'Port number')
    .option('--provider <provider>', 'LLM provider (openai or claude)')
    .option('-m, --model <model>', 'Model name')
    .option('--max-iterations <n>', 'Max reasoning iterations')
    .option('--budget <n>', 'Token budget')
    .option('--complexity-threshold <n>', 'Complexity threshold for looping')
    .option('-o, --output-dir <dir>', 'Output directory')
    .option('--log-level <level>', 'Log level (trace|debug|info|warn|error|fatal)')
    .option('--storage-type <type>', 'Storage type (json|sqlite)')
    .action(async (options: Record<string, unknown>) => {
      const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) {
        console.error('Error: Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
        process.exit(1);
      }

      // Build config overrides from CLI options — use Record to avoid
      // partial-nested-object type mismatches with Partial<ReasonLoopConfig>
      const overrides: Record<string, unknown> = {};

      if (options.port !== undefined) {
        overrides.server = { ...(overrides.server as object ?? {}), port: Number(options.port) };
      }
      if (options.model !== undefined) {
        overrides.models = { ...(overrides.models as object ?? {}), default: options.model as string };
      }
      if (options.maxIterations !== undefined) {
        overrides.convergence = { ...(overrides.convergence as object ?? {}), maxIterations: Number(options.maxIterations) };
      }
      if (options.budget !== undefined) {
        overrides.convergence = { ...(overrides.convergence as object ?? {}), budgetLimit: Number(options.budget) };
      }
      if (options.complexityThreshold !== undefined) {
        overrides.convergence = { ...(overrides.convergence as object ?? {}), complexityThreshold: Number(options.complexityThreshold) };
      }
      if (options.outputDir !== undefined) {
        overrides.storage = { ...(overrides.storage as object ?? {}), path: options.outputDir as string };
      }
      if (options.logLevel !== undefined) {
        overrides.observability = { ...(overrides.observability as object ?? {}), logLevel: options.logLevel as ReasonLoopConfig['observability']['logLevel'] };
      }
      if (options.storageType !== undefined) {
        overrides.storage = { ...(overrides.storage as object ?? {}), type: options.storageType as ReasonLoopConfig['storage']['type'] };
      }

      // Handle provider-specific API key injection
      const provider = options.provider as string | undefined;
      if (provider === 'openai') {
        overrides.models = { ...(overrides.models as object ?? {}), providers: { openai: { apiKey } } };
      } else if (provider === 'claude') {
        overrides.models = { ...(overrides.models as object ?? {}), providers: { anthropic: { apiKey } } };
      }

      const cfg = loadConfig(overrides as Partial<ReasonLoopConfig>);
      const serverConfig = mapToServerConfig(cfg, apiKey);

      await startServer(serverConfig);
    });
}
