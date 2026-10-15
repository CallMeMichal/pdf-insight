import {
  SCHEMA_VERSION,
  type AnalyzeErrorCode,
  type AnalyzeRequest,
  type Result,
} from '@pdf-insight/shared';
import { corsHeaders, isOriginAllowed } from './cors';
import type { ModelAdapter } from './model';
import { generatedResultSchema, type GeneratedResult } from './generatedResult';

export interface HandlerConfig {
  allowedOrigins: string[];
  model: ModelAdapter;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function error(code: AnalyzeErrorCode, status: number, headers?: Record<string, string>): Response {
  return json({ error: code }, status, headers);
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

/**
 * Odpytuje model, aż zwróci poprawną odpowiedź, najwyżej `MAX_ATTEMPTS` razy.
 * Ponawiana jest tylko niepoprawna odpowiedź; błąd dostawcy kończy Analizę od razu.
 */
async function runAttempts(
  documentText: string,
  model: ModelAdapter,
): Promise<{ ok: true; generated: GeneratedResult } | { ok: false; error: AnalyzeErrorCode }> {
  const signal = AbortSignal.timeout(ANALYSIS_TIMEOUT_MS);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await model.generate(documentText, signal);
    if (!response.ok) {
      console.error(`Próba ${attempt}: błąd dostawcy AI ${response.error}`);
      return { ok: false, error: 'AI_PROVIDER_ERROR' };
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
  if (url.pathname !== '/analyze') return error('NOT_FOUND', 404);

  const origin = request.headers.get('Origin');
  if (!origin || !isOriginAllowed(origin, config.allowedOrigins)) {
    return error('ORIGIN_NOT_ALLOWED', 403);
  }
  const cors = corsHeaders(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return error('METHOD_NOT_ALLOWED', 405, { ...cors, Allow: 'POST, OPTIONS' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('INVALID_INPUT', 400, cors);
  }
  const analyzeRequest = parseAnalyzeRequest(body);
  if (!analyzeRequest) return error('INVALID_INPUT', 400, cors);

  // Niepoprawny Wynik nigdy nie opuszcza Workera.
  const attempts = await runAttempts(analyzeRequest.text, config.model);
  if (!attempts.ok) return error(attempts.error, 502, cors);

  return json(toResult(attempts.generated, analyzeRequest, config.model.modelName), 200, cors);
}
