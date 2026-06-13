import { ReasonLoopConfigSchema, type ReasonLoopConfig } from './schema.js';

export type { ReasonLoopConfig };

export function loadConfig(overrides?: Partial<ReasonLoopConfig>): ReasonLoopConfig {
  const envOverrides: Record<string, unknown> = {};

  if (process.env.REASONLOOP_PORT) {
    envOverrides.server = { ...(envOverrides.server as object || {}), port: Number(process.env.REASONLOOP_PORT) };
  }
  if (process.env.REASONLOOP_HOST) {
    envOverrides.server = { ...(envOverrides.server as object || {}), host: process.env.REASONLOOP_HOST };
  }
  if (process.env.REASONLOOP_API_KEY) {
    envOverrides.auth = { apiKeys: [process.env.REASONLOOP_API_KEY] };
  }
  if (process.env.REASONLOOP_MODEL) {
    envOverrides.models = { default: process.env.REASONLOOP_MODEL };
  }
  if (process.env.REASONLOOP_LOG_LEVEL) {
    envOverrides.observability = { logLevel: process.env.REASONLOOP_LOG_LEVEL as ReasonLoopConfig['observability']['logLevel'] };
  }
  if (process.env.REASONLOOP_STORAGE_TYPE) {
    envOverrides.storage = { ...(envOverrides.storage as object || {}), type: process.env.REASONLOOP_STORAGE_TYPE as ReasonLoopConfig['storage']['type'] };
  }
  if (process.env.REASONLOOP_STORAGE_PATH) {
    envOverrides.storage = { ...(envOverrides.storage as object || {}), path: process.env.REASONLOOP_STORAGE_PATH };
  }

  const merged = deepMerge(deepMerge({}, envOverrides), overrides ?? {});
  return ReasonLoopConfigSchema.parse(merged);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
