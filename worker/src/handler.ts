import {
  MAX_TEXT_LENGTH,
  SCHEMA_VERSION,
  type AnalyzeErrorCode,
  type AnalyzeRequest,
  type Result,
} from '@pdf-insight/shared';
import { corsHeaders, isOriginAllowed } from './cors';
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
  METHOD_NOT_ALLOWED: 405,
  TEXT_TOO_LONG: 413,
  PAYLOAD_TOO_LARGE: 413,
  MINUTE_RATE_LIMITED: 429,
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
 * Największe dopuszczalne ciało żądania. Tekst o długości `MAX_TEXT_LENGTH` w najgorszym
 * przypadku zajmuje w JSON-ie 6 bajtów na znak (`\u0001`), do tego zapas na pozostałe pola.
 */
const MAX_BODY_BYTES = 6 * MAX_TEXT_LENGTH + 64 * 1024;

/**
 * Czyta ciało strumieniowo i przerywa po przekroczeniu `maxBytes`, zamiast buforować dowolnie
 * duże żądanie. Zwraca `null`, gdy ciało jest za duże.
 */
async function readBody(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function parseAnalyzeRequest(body: unknown): AnalyzeRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { text, fileName, pages } = body as Record<string, unknown>;
  if (typeof text !== 'string' || typeof fileName !== 'string') return null;
  if (typeof pages !== 'number' || !Number.isInteger(pages) || pages < 1) return null;
  return { text, fileName, pages };
}

function parseGeneratedResult(text: string): GeneratedResult | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = generatedResultSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
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
    const generated = parseGeneratedResult(response.text);
    if (generated) return { ok: true, generated };
  }
  return { ok: false, error: 'INVALID_RESULT' };
}

/** Nazwa pliku i liczba stron pochodzą z żądania (z pliku), nigdy od modelu. */
function toResult(generated: GeneratedResult, request: AnalyzeRequest, modelName: string): Result {
  return {
    ...generated,
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
  if (!origin || !isOriginAllowed(origin, config.allowedOrigins)) {
    return error('ORIGIN_NOT_ALLOWED');
  }
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return error('METHOD_NOT_ALLOWED', { ...cors, Allow: 'POST, OPTIONS' });
  }

  const rawBody = await readBody(request, MAX_BODY_BYTES);
  if (rawBody === null) return error('PAYLOAD_TOO_LARGE', cors);
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return error('INVALID_INPUT', cors);
  }
  const analyzeRequest = parseAnalyzeRequest(body);
  if (!analyzeRequest) return error('INVALID_INPUT', cors);
  if (!analyzeRequest.text.trim()) return error('EMPTY_TEXT', cors);
  if (analyzeRequest.text.length > MAX_TEXT_LENGTH) return error('TEXT_TOO_LONG', cors);

  // Limit liczy tylko żądania, które przeszły walidację, czyli faktyczne Analizy.
  // Cloudflare zawsze ustawia CF-Connecting-IP; brak nagłówka trafia do wspólnego licznika.
  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const decision = await config.rateLimiter.check(clientIp);
  if (!decision.ok) {
    const code = decision.window === 'minute' ? 'MINUTE_RATE_LIMITED' : 'DAILY_RATE_LIMITED';
    return error(code, {
      ...cors,
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }

  // Niepoprawny Wynik nigdy nie opuszcza Workera.
  const attempts = await runAttempts(analyzeRequest.text, config.model);
  if (!attempts.ok) return error(attempts.error, cors);

  return json(toResult(attempts.generated, analyzeRequest, config.model.modelName), 200, cors);
}
