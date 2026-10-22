import { z } from 'zod';

// Server configuration, validated once at startup (src/instrumentation.ts) so
// a missing or malformed variable stops the server with a clear message,
// instead of surfacing later as a confusing runtime error on some request.

const isProduction = process.env.NODE_ENV === 'production';

const envSchema = z
  .object({
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL is required (a PostgreSQL connection string).' })
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgres:// or postgresql:// URL.'),
    JWT_SECRET: z
      .string({ error: 'JWT_SECRET is required. Generate one with `openssl rand -base64 32`.' })
      .min(isProduction ? 32 : 1, 'JWT_SECRET must be at least 32 characters in production.'),
    NEXT_PUBLIC_APP_URL: z.url('NEXT_PUBLIC_APP_URL must be a full URL, e.g. https://styleiq.example').optional(),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(10).optional(),
    UPSTASH_REDIS_REST_URL: z.url('UPSTASH_REDIS_REST_URL must be the https URL from the Upstash console.').optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  })
  .refine((env) => !!env.UPSTASH_REDIS_REST_URL === !!env.UPSTASH_REDIS_REST_TOKEN, {
    message: 'Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither.',
  });

export type ServerEnv = z.infer<typeof envSchema>;

/** Throws one readable error listing every problem with the environment. */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Treat empty strings (e.g. `FOO=` in .env) as unset.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.message}`).join('\n');
    throw new Error(`Invalid server configuration (see .env.example):\n${problems}`);
  }
  if (!isProduction && result.data.JWT_SECRET.length < 32) {
    console.warn('JWT_SECRET is shorter than 32 characters — fine for local dev, not for production.');
  }
  return result.data;
}
