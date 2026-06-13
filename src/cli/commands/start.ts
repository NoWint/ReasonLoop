import type { Command } from 'commander';
import { startServer } from '../../gateway/server.js';
import type { ServerConfig } from '../../core/types.js';

export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the ReasonLoop proxy server')
    .option('-p, --port <port>', 'Port number', '8080')
    .option('--provider <provider>', 'LLM provider (openai or claude)', 'openai')
    .option('-m, --model <model>', 'Model name', 'gpt-4')
    .option('--max-iterations <n>', 'Max reasoning iterations', '10')
    .option('--budget <n>', 'Token budget', '100000')
    .option('--complexity-threshold <n>', 'Complexity threshold for looping', '0.5')
    .option('-o, --output-dir <dir>', 'Output directory', './reasonloop-output')
    .action(async (options: Record<string, unknown>) => {
      const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
      if (!apiKey) {
        console.error('Error: Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
        process.exit(1);
      }

      const config: ServerConfig = {
        port: Number(options.port),
        provider: options.provider as 'openai' | 'claude',
        model: options.model as string,
        apiKey,
        maxIterations: Number(options.maxIterations),
        budget: Number(options.budget),
        stabilityThreshold: 0.85,
        minIterations: 2,
        complexityThreshold: Number(options.complexityThreshold),
        outputDir: options.outputDir as string,
        loopTimeoutMs: 60000,
      };

      await startServer(config);
    });
}
