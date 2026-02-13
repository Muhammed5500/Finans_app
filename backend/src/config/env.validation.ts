import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // API
  PORT: z.coerce.number().int().positive().default(4000),

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis & Job Scheduling
  USE_REDIS_QUEUE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  REDIS_URL: z.string().optional(),

  // Ingestion scheduling
  INGESTION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // GDELT
  GDELT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  GDELT_QUERY: z
    .string()
    .default('market OR stock OR crypto OR inflation OR central bank'),
  GDELT_QUERIES: z.string().default('Tesla,Fed,BTC,SP500'),
  GDELT_MAX_RECORDS: z.coerce.number().int().min(1).max(250).default(100),

  // SEC RSS
  SEC_RSS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SEC_USER_AGENT: z
    .string()
    .default('FinansBackend/1.0 (contact: dev@example.com)'),
  APP_UA: z.string().default('FinansTakip/1.0 (contact@example.com)'),

  // KAP
  KAP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  KAP_LANG: z.enum(['tr', 'en']).default('tr'),

  // Google News RSS
  ENABLE_GOOGLE_NEWS_RSS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  GOOGLE_NEWS_RSS_URL: z.string().url().optional(),
  GOOGLE_NEWS_QUERIES: z.string().default('BIST,TUPRS,BTC,SP500'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${msg}`);
  }
  return parsed.data;
}
