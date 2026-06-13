import type { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import { PROVIDER_PRESETS, loadUserConfig, saveUserConfig, type UserConfig } from '../setup/provider.js';
import { EXPORT_TARGETS, exportToTarget, exportToAll } from '../setup/export.js';

async function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? chalk.gray(` (${defaultValue})`) : '';
  const answer = await rl.question(`${question}${hint}: `);
  return answer.trim() || (defaultValue ?? '');
}

async function askYesNo(rl: readline.Interface, question: string, defaultValue: boolean): Promise<boolean> {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  const answer = await rl.question(`${question} (${hint}): `);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === '') return defaultValue;
  return trimmed === 'y' || trimmed === 'yes';
}

async function interactiveSetup(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('');
    console.log(chalk.cyan.bold('  ╔══════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('  ║        ReasonLoop Setup              ║'));
    console.log(chalk.cyan.bold('  ╚══════════════════════════════════════╝'));
    console.log('');

    // Load existing config as defaults
    const existing = loadUserConfig();

    // 1. Select provider
    console.log(chalk.bold('Select a provider:'));
    PROVIDER_PRESETS.forEach((p, i) => {
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${p.name}`);
    });
    console.log('');

    const providerIndex = parseInt(await ask(rl, 'Provider number', existing ? String(PROVIDER_PRESETS.findIndex(p => p.id === existing.provider) + 1) : '1'), 10) - 1;
    const preset = PROVIDER_PRESETS[Math.max(0, Math.min(providerIndex, PROVIDER_PRESETS.length - 1))];

    console.log(chalk.green(`  ✓ Selected: ${preset.name}`));
    console.log('');

    // 2. API key
    const apiKey = await ask(rl, `API Key (${preset.envVar})`, existing?.apiKey);
    if (!apiKey) {
      console.log(chalk.red('  ✗ API key is required.'));
      rl.close();
      process.exit(1);
    }
    console.log(chalk.green('  ✓ API key set'));
    console.log('');

    // 3. Base URL (for DeepSeek/Custom)
    let baseUrl = preset.baseUrl;
    if (!baseUrl || preset.id === 'deepseek' || preset.id === 'custom') {
      baseUrl = await ask(rl, 'Base URL', existing?.baseUrl || preset.baseUrl || undefined);
    }
    console.log(chalk.green(`  ✓ Base URL: ${baseUrl}`));
    console.log('');

    // 4. Model
    const model = await ask(rl, 'Model name', existing?.model || preset.defaultModel || undefined);
    console.log(chalk.green(`  ✓ Model: ${model}`));
    console.log('');

    // 5. Multi-view
    const multiView = await askYesNo(rl, 'Enable multi-view reasoning by default?', existing?.multiView ?? false);
    console.log(chalk.green(`  ✓ Multi-view: ${multiView ? 'enabled' : 'disabled'}`));
    console.log('');

    // 6. Max iterations
    const maxIterationsStr = await ask(rl, 'Max reasoning iterations', String(existing?.maxIterations ?? 5));
    const maxIterations = parseInt(maxIterationsStr, 10) || 5;

    // 7. Budget
    const budgetStr = await ask(rl, 'Token budget', String(existing?.budget ?? 100000));
    const budget = parseInt(budgetStr, 10) || 100000;

    // Build config
    const config: UserConfig = {
      provider: preset.id,
      apiKey,
      baseUrl,
      model,
      multiView,
      maxIterations,
      budget,
      exports: {
        claudeCode: false,
        cursor: false,
        codex: false,
      },
    };

    // Save config
    saveUserConfig(config);
    console.log('');
    console.log(chalk.green('  ✓ Configuration saved to ~/.reasonloop/config.json'));
    console.log('');

    // 8. Export
    console.log(chalk.bold('Export configuration to external tools?'));
    console.log('  This will configure tools to route through ReasonLoop proxy.');
    console.log('');

    for (const target of EXPORT_TARGETS) {
      const doExport = await askYesNo(rl, `  Export to ${target.name}?`, false);
      if (doExport) {
        target.export(apiKey);
        config.exports[target.id === 'claude-code' ? 'claudeCode' : target.id as 'cursor' | 'codex'] = true;
        console.log(chalk.green(`    ✓ Exported to ${target.name}`));
      }
    }

    // Save again with export flags
    saveUserConfig(config);

    console.log('');
    console.log(chalk.cyan.bold('  Setup complete!'));
    console.log('');
    console.log(chalk.gray('  Run `reasonloop start` to launch the proxy server.'));
    console.log('');
  } finally {
    rl.close();
  }
}

function nonInteractiveExport(targetId: string): void {
  const config = loadUserConfig();
  if (!config) {
    console.error(chalk.red('No saved configuration found. Run `reasonloop setup` first.'));
    process.exit(1);
  }

  if (targetId === 'all') {
    exportToAll(config.apiKey);
    console.log(chalk.green('✓ Exported to all tools.'));
  } else {
    exportToTarget(targetId, config.apiKey);
    const target = EXPORT_TARGETS.find(t => t.id === targetId);
    console.log(chalk.green(`✓ Exported to ${target?.name ?? targetId}.`));
  }
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard for ReasonLoop')
    .option('--export <tool>', 'Non-interactive export to tool (claude-code, cursor, codex, all)')
    .action(async (options: { export?: string }) => {
      if (options.export) {
        nonInteractiveExport(options.export);
      } else {
        await interactiveSetup();
      }
    });
}
