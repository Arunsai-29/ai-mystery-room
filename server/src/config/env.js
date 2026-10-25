import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), override: false });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/ai-mystery-room').refine((uri) => /^mongodb(\+srv)?:\/\//.test(uri), 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_TEXT_MODEL: z.string().default('gemini-3.8-flash'),
  GEMINI_TEXT_FALLBACK_MODEL: z.string().default('gemini-3.6-flash'),
  GEMINI_TEXT_SECONDARY_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-image'),
  ENABLE_IMAGE_GENERATION: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  UPLOAD_DIR: z.string().default('./uploads'),
  RATE_LIMIT_CASES_PER_HOUR: z.coerce.number().default(5),
  GENERATION_TIMEOUT_MS: z.coerce.number().default(300000),
  SESSION_COOKIE_NAME: z.string().default('mr_sid')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.message}`);
export const env = parsed.data;
