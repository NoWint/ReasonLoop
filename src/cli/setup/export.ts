import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROXY_URL = 'http://localhost:8080/v1';

export interface ExportTarget {
  id: string;
  name: string;
  configPath: string;
  export: (apiKey: string) => void;
}

export const EXPORT_TARGETS: ExportTarget[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    configPath: join(homedir(), '.claude', 'settings.json'),
    export: (apiKey: string) => {
      const dir = join(homedir(), '.claude');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const path = join(dir, 'settings.json');
      let settings: Record<string, unknown> = {};
      if (existsSync(path)) {
        try { settings = JSON.parse(readFileSync(path, 'utf-8')); } catch { /* ignore */ }
      }
      settings.apiBaseUrl = PROXY_URL;
      settings.apiKey = apiKey;
      writeFileSync(path, JSON.stringify(settings, null, 2));
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    configPath: join(process.cwd(), '.env'),
    export: (apiKey: string) => {
      const envPath = join(process.cwd(), '.env');
      let content = '';
      if (existsSync(envPath)) {
        content = readFileSync(envPath, 'utf-8');
      }
      const lines = content.split('\n').filter(l =>
        !l.startsWith('OPENAI_BASE_URL=') && !l.startsWith('OPENAI_API_KEY=')
      );
      lines.push(`OPENAI_BASE_URL=${PROXY_URL}`);
      lines.push(`OPENAI_API_KEY=${apiKey}`);
      writeFileSync(envPath, lines.join('\n'));
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    configPath: join(homedir(), '.codex', 'config.json'),
    export: (apiKey: string) => {
      const dir = join(homedir(), '.codex');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const path = join(dir, 'config.json');
      let config: Record<string, unknown> = {};
      if (existsSync(path)) {
        try { config = JSON.parse(readFileSync(path, 'utf-8')); } catch { /* ignore */ }
      }
      config.baseURL = PROXY_URL;
      config.apiKey = apiKey;
      writeFileSync(path, JSON.stringify(config, null, 2));
    },
  },
];

export function exportToTarget(targetId: string, apiKey: string): void {
  const target = EXPORT_TARGETS.find(t => t.id === targetId);
  if (target) target.export(apiKey);
}

export function exportToAll(apiKey: string): void {
  for (const target of EXPORT_TARGETS) {
    target.export(apiKey);
  }
}
