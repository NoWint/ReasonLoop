import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerStartCommand } from '../../src/cli/commands/start.js';
import { registerStatusCommand } from '../../src/cli/commands/status.js';
import { registerSessionsCommand } from '../../src/cli/commands/sessions.js';
import { registerInspectCommand } from '../../src/cli/commands/inspect.js';

describe('CLI Commands', () => {
  it('should register all commands', () => {
    const program = new Command();
    registerStartCommand(program);
    registerStatusCommand(program);
    registerSessionsCommand(program);
    registerInspectCommand(program);
    expect(program.commands.map(c => c.name())).toContain('start');
    expect(program.commands.map(c => c.name())).toContain('status');
    expect(program.commands.map(c => c.name())).toContain('sessions');
    expect(program.commands.map(c => c.name())).toContain('inspect');
  });
});
