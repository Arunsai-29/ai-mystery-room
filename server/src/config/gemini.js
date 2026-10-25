import { GoogleGenAI } from '@google/genai';
import { env } from './env.js';

export const gemini = env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, timeout: 60000, maxRetries: 0 }) : null;
export const models = {
  text: env.GEMINI_TEXT_MODEL,
  textFallbacks: [env.GEMINI_TEXT_FALLBACK_MODEL, env.GEMINI_TEXT_SECONDARY_MODEL].filter((model, index, all) => model && model !== env.GEMINI_TEXT_MODEL && all.indexOf(model) === index),
  image: env.GEMINI_IMAGE_MODEL
};
