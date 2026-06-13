import type { Command } from 'commander';
import chalk from 'chalk';

export function registerSessionsCommand(program: Command): void {
  program
    .command('sessions')
    .description('List all reasoning sessions')
    .option('-p, --port <port>', 'Port number', '8080')
    .action(async (options: Record<string, unknown>) => {
      const port = Number(options.port);
      try {
        const response = await fetch(`http://localhost:${port}/v1/sessions`);
        const data = await response.json() as any;
        if (data.sessions.length === 0) {
          console.log(chalk.yellow('No active sessions.'));
        } else {
          for (const s of data.sessions) {
            console.log(`[${s.id}] "${s.goal}" | ${s.iteration} iterations | stability: ${s.stability.toFixed(2)} | claims: ${s.claims}`);
          }
        }
      } catch {
        console.log(chalk.red('Cannot connect to ReasonLoop server.'));
      }
    });
}
