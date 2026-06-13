import {z} from 'zod';

const AuthSchema = z.object({
  enabled: z.boolean().default(false),
  apiKeys: z.array(z.string()).default([]),
});

const RawConfigSchema = z.object({
  server: z.object({
    port: z.number().int().min(1).max(65535).default(8080),
    host: z.string().default('0.0.0.0'),
  }).default({ port: 8080, host: '0.0.0.0' }),

  auth: AuthSchema.default({ enabled: false, apiKeys: [] }),

  rateLimit: z.object({
    maxRequests: z.number().int().min(1).default(100),
    windowMs: z.number().int().min(1000).default(60000),
  }).default({ maxRequests: 100, windowMs: 60000 }),

  complexity: z.object({
    threshold: z.number().min(0).max(1).default(0.5),
  }).default({ threshold: 0.5 }),

  convergence: z.object({
    maxIterations: z.number().int().min(1).default(10),
    budgetLimit: z.number().min(0).default(100000),
    stabilityThreshold: z.number().min(0).max(1).default(0.85),
    minIterations: z.number().int().min(0).default(2),
    complexityThreshold: z.number().min(0).max(1).default(0.5),
  }).default({ maxIterations: 10, budgetLimit: 100000, stabilityThreshold: 0.85, minIterations: 2, complexityThreshold: 0.5 }),

  models: z.object({
    default: z.string().default('gpt-4'),
    timeout: z.number().int().min(1000).default(60000),
    providers: z.object({
      openai: z.object({
        apiKey: z.string().default(''),
        baseUrl: z.string().optional(),
      }).optional(),
      anthropic: z.object({
        apiKey: z.string().default(''),
        baseUrl: z.string().optional(),
      }).optional(),
    }).default({}),
  }).default({ default: 'gpt-4', timeout: 60000, providers: {} }),

  observability: z.object({
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    metrics: z.boolean().default(true),
    tracing: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().optional(),
    }).default({ enabled: false }),
  }).default({ logLevel: 'info', metrics: true, tracing: { enabled: false } }),

  storage: z.object({
    type: z.enum(['json', 'sqlite']).default('sqlite'),
    path: z.string().default('./data/reasonloop'),
  }).default({ type: 'sqlite', path: './data/reasonloop' }),

  multiView: z.object({
    enabled: z.boolean().default(false),
    views: z.array(z.object({
      id: z.string(),
      name: z.string(),
      systemPrompt: z.string(),
      focusAreas: z.array(z.string()),
      weight: z.number().min(0).max(1),
    })).default([]),
  }).default({ enabled: false, views: [] }),

  memory: z.object({
    enabled: z.boolean().default(false),
    topK: z.number().int().min(1).default(5),
  }).default({ enabled: false, topK: 5 }),

  loop: z.object({
    timeout: z.number().int().min(1000).default(300000),
    maxRetries: z.number().int().min(0).default(3),
    retryBaseDelay: z.number().int().min(100).default(1000),
  }).default({ timeout: 300000, maxRetries: 3, retryBaseDelay: 1000 }),
});

export const ReasonLoopConfigSchema = RawConfigSchema.transform(config => ({
  ...config,
  auth: {
    ...config.auth,
    enabled: config.auth.apiKeys.length > 0 ? true : config.auth.enabled,
  },
}));

export type ReasonLoopConfig = z.infer<typeof ReasonLoopConfigSchema>;
