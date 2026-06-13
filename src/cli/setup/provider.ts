export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  envVar: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4', envVar: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514', envVar: 'ANTHROPIC_API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', envVar: 'OPENAI_API_KEY' },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', baseUrl: '', defaultModel: '', envVar: 'OPENAI_API_KEY' },
];

export interface UserConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  multiView: boolean;
  maxIterations: number;
  budget: number;
  exports: {
    claudeCode: boolean;
    cursor: boolean;
    codex: boolean;
  };
}

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.reasonloop');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadUserConfig(): UserConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveUserConfig(config: UserConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
