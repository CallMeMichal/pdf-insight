import { createCloudflareRateLimiter, type DailyAnalysisCounter } from './cloudflareRateLimiter';
import { createGeminiAdapter } from './gemini';
import { handleRequest } from './handler';

export { DailyAnalysisCounter } from './cloudflareRateLimiter';

export interface Env {
  ALLOWED_ORIGINS: string;
  /** Nazwa modelu Gemini — zmiana modelu bez zmiany kodu. */
  GEMINI_MODEL: string;
  /** Sekret Workera (`wrangler secret put GEMINI_API_KEY`), lokalnie w `.dev.vars`. */
  GEMINI_API_KEY: string;
  /** Binding Rate Limiting: minutowy limit Analiz na adres IP (wartość w wrangler.toml). */
  MINUTE_RATE_LIMITER: RateLimit;
  /** Durable Object z dobowym licznikiem Analiz na adres IP. */
  DAILY_RATE_LIMITER: DurableObjectNamespace<DailyAnalysisCounter>;
}

export default {
  fetch(request, env) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const model = createGeminiAdapter({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
    const rateLimiter = createCloudflareRateLimiter(
      env.MINUTE_RATE_LIMITER,
      env.DAILY_RATE_LIMITER,
    );
    return handleRequest(request, { allowedOrigins, model, rateLimiter });
  },
} satisfies ExportedHandler<Env>;
