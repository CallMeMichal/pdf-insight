import { createGeminiAdapter } from './gemini';
import { handleRequest } from './handler';

export interface Env {
  ALLOWED_ORIGINS: string;
  /** Nazwa modelu Gemini — zmiana modelu bez zmiany kodu. */
  GEMINI_MODEL: string;
  /** Sekret Workera (`wrangler secret put GEMINI_API_KEY`), lokalnie w `.dev.vars`. */
  GEMINI_API_KEY: string;
}

export default {
  fetch(request, env) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const model = createGeminiAdapter({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
    return handleRequest(request, { allowedOrigins, model });
  },
} satisfies ExportedHandler<Env>;
