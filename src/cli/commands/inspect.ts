import type { Command } from 'commander';
import chalk from 'chalk';

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect <sessionId>')
    .description('Inspect a reasoning session')
    .option('-p, --port <port>', 'Port number', '8080')
    .option('--diff <range>', 'Show diff between iterations (e.g. 2-3)')
    .action(async (sessionId: string, options: Record<string, unknown>) => {
      const port = Number(options.port);
      try {
        const response = await fetch(`http://localhost:${port}/v1/sessions`);
        const data = await response.json() as any;
        const session = data.sessions.find((s: any) => s.id === sessionId);
        if (!session) {
          console.log(chalk.yellow(`Session ${sessionId} not found.`));
          return;
        }
        console.log(chalk.bold(`Session: ${session.id}`));
        console.log(`Goal: ${session.goal}`);
        console.log(`Iterations: ${session.iteration}`);
        console.log(`Stability: ${session.stability.toFixed(2)}`);
        console.log(`Claims: ${session.claims}`);
      } catch {
        console.log(chalk.red('Cannot connect to ReasonLoop server.'));
      }
    });
}
