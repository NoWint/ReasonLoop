import type { Command } from 'commander';
import chalk from 'chalk';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check ReasonLoop server status')
    .option('-p, --port <port>', 'Port number', '8080')
    .action(async (options: Record<string, unknown>) => {
      const port = Number(options.port);
      try {
        const response = await fetch(`http://localhost:${port}/v1/models`);
        const data = await response.json();
        console.log(chalk.green(`ReasonLoop running on :${port}`));
        console.log(`Available models: ${JSON.stringify(data)}`);
      } catch {
        console.log(chalk.red(`ReasonLoop not running on :${port}`));
      }
    });
}
