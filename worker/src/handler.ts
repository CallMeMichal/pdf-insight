import type { z } from 'zod';
import {
  analyzeRequestSchema,
  MAX_AMOUNTS,
  MAX_DATE_MENTIONS,
  MAX_TEXT_LENGTH,
  SCHEMA_VERSION,
  type AnalyzeErrorCode,
  type AnalyzeRequest,
  type Result,
} from '@pdf-insight/shared';
import { corsHeaders } from './cors';
import type { ModelAdapter } from './model';
import { generatedResultSchema, type GeneratedResult } from './generatedResult';
import type { RateLimiter } from './rateLimit';

export interface HandlerConfig {
  allowedOrigins: string[];
  model: ModelAdapter;
  rateLimiter: RateLimiter;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Status HTTP wynika z kodu błędu (kontrakt API w specyfikacji). */
const ERROR_STATUS: Record<AnalyzeErrorCode, number> = {
  INVALID_INPUT: 400,
  EMPTY_TEXT: 400,
  ORIGIN_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  TEXT_TOO_LONG: 413,
  DAILY_RATE_LIMITED: 429,
  INVALID_RESULT: 502,
  AI_PROVIDER_ERROR: 502,
  // Wyczerpany limit dostawcy AI to stan przejściowy, a nie błąd dostawcy — stąd 503.
  AI_QUOTA_EXCEEDED: 503,
};

function error(code: AnalyzeErrorCode, headers?: Record<string, string>): Response {
  return json({ error: code }, ERROR_STATUS[code], headers);
}

/**
 * Największe dopuszczalne ciało żądania w znakach. Tekst o długości `MAX_TEXT_LENGTH`
 * w najgorszym przypadku zajmuje w JSON-ie 6 znaków na znak (`\u0001`), do tego zapas na
 * pozostałe pola. Większe ciało (np. ogromna nazwa pliku) jest odrzucane przed parsowaniem.
 */
const MAX_BODY_LENGTH = 6 * MAX_TEXT_LENGTH + 64 * 1024;

/** Parsuje JSON i waliduje go schematem; `null`, gdy nie jest JSON-em albo nie pasuje. */
function parseJson<T>(text: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Automatyczna ponowna Próba po niepoprawnej odpowiedzi modelu — łącznie dwie Próby. */
const MAX_ATTEMPTS = 2;

/**
 * Łączny czas na wszystkie Próby jednej Analizy. Użytkownik ma dostać Wynik w mniej niż 30 s,
 * a część tego czasu zajmuje odczyt PDF-a i sieć po stronie przeglądarki. Druga Próba dostaje
 * tylko resztę tego czasu: gdy pierwsza zużyje go prawie cały, druga zostanie przerwana
 * (`AI_PROVIDER_ERROR`) — limit 30 s ma pierwszeństwo przed ponowieniem.
 */
const ANALYSIS_TIMEOUT_MS = 25_000;

type AttemptsOutcome =
  { ok: true; generated: GeneratedResult } | { ok: false; error: AnalyzeErrorCode };

/**
 * Odpytuje model, aż zwróci poprawną odpowiedź, najwyżej `MAX_ATTEMPTS` razy.
 * Ponawiana jest tylko niepoprawna odpowiedź; błąd dostawcy kończy Analizę od razu.
 */
async function runAttempts(documentText: string, model: ModelAdapter): Promise<AttemptsOutcome> {
  const signal = AbortSignal.timeout(ANALYSIS_TIMEOUT_MS);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await model.generate(documentText, signal);
    if (!response.ok) {
      console.error(`Próba ${attempt}: błąd dostawcy AI ${response.error}`);
      return {
        ok: false,
        error: response.error === 'RATE_LIMITED' ? 'AI_QUOTA_EXCEEDED' : 'AI_PROVIDER_ERROR',
      };
    }
    const generated = parseJson(response.text, generatedResultSchema);
    if (generated) return { ok: true, generated };
  }
  return { ok: false, error: 'INVALID_RESULT' };
}

/**
 * Nazwa pliku i liczba stron pochodzą z żądania (z pliku), nigdy od modelu. Nadmiar Kwot i dat
 * jest przycinany, a nie ponawiany (Próba podwoiłaby czas) — prompt każe podać najważniejsze
 * najpierw.
 */
function toResult(generated: GeneratedResult, request: AnalyzeRequest, modelName: string): Result {
  return {
    ...generated,
    amounts: generated.amounts.slice(0, MAX_AMOUNTS),
    dates: generated.dates.slice(0, MAX_DATE_MENTIONS),
    document: { ...generated.document, fileName: request.fileName, pages: request.pages },
    meta: {
      analyzedAt: new Date().toISOString(),
      model: modelName,
      schemaVersion: SCHEMA_VERSION,
    },
  };
}

export async function handleRequest(request: Request, config: HandlerConfig): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/analyze') return error('NOT_FOUND');

  const origin = request.headers.get('Origin');
  if (!origin || !config.allowedOrigins.includes(origin)) {
    return error('ORIGIN_NOT_ALLOWED');
  }
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return error('NOT_FOUND', cors);

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_LENGTH) return error('TEXT_TOO_LONG', cors);
  const analyzeRequest = parseJson(rawBody, analyzeRequestSchema);
  if (!analyzeRequest) return error('INVALID_INPUT', cors);
  if (!analyzeRequest.text.trim()) return error('EMPTY_TEXT', cors);
  if (analyzeRequest.text.length > MAX_TEXT_LENGTH) return error('TEXT_TOO_LONG', cors);

  // Limit liczy tylko żądania, które przeszły walidację, czyli faktyczne Analizy.
  // Cloudflare zawsze ustawia CF-Connecting-IP; brak nagłówka trafia do wspólnego licznika.
  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const decision = await config.rateLimiter.check(clientIp);
  if (!decision.ok) {
    return error('DAILY_RATE_LIMITED', {
      ...cors,
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }

  // Niepoprawny Wynik nigdy nie opuszcza Workera.
  const attempts = await runAttempts(analyzeRequest.text, config.model);
  if (!attempts.ok) return error(attempts.error, cors);

  return json(toResult(attempts.generated, analyzeRequest, config.model.modelName), 200, cors);
}
