import type { ProxyRequest, ProxyResponse, ServerConfig, ReasoningState } from '../../core/types.js';

export type { ProxyRequest, ProxyResponse, ServerConfig };

export interface GatewayContext {
  config: ServerConfig;
  sessions: Map<string, ReasoningState>;
}
