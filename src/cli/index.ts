import { Command } from 'commander';
import { registerStartCommand } from './commands/start.js';
import { registerStatusCommand } from './commands/status.js';
import { registerSessionsCommand } from './commands/sessions.js';
import { registerInspectCommand } from './commands/inspect.js';
import { registerSetupCommand } from './commands/setup.js';
import { registerChatCommand } from './commands/chat.js';

export function runCLI(): void {
  const program = new Command();
  program
    .name('reasonloop')
    .description('ReasonLoop — A reasoning middleware between agents and models')
    .version('0.1.0');

  registerStartCommand(program);
  registerStatusCommand(program);
  registerSessionsCommand(program);
  registerInspectCommand(program);
  registerSetupCommand(program);
  registerChatCommand(program);

  program.parse();
}

if (process.argv[1]?.endsWith('cli/index.js') || process.argv[1]?.endsWith('cli/index.ts')) {
  runCLI();
}
