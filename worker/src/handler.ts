import type { AnalyzeRequest } from '@pdf-insight/shared';
import { corsHeaders, isOriginAllowed } from './cors';
import { stubResult } from './stubResult';

export interface HandlerConfig {
  allowedOrigins: string[];
}

type ErrorCode = 'ORIGIN_NOT_ALLOWED' | 'INVALID_INPUT' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED';

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function error(code: ErrorCode, status: number, headers?: Record<string, string>): Response {
  return json({ error: code }, status, headers);
}

function parseAnalyzeRequest(body: unknown): AnalyzeRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { text, fileName, pages } = body as Record<string, unknown>;
  if (typeof text !== 'string' || typeof fileName !== 'string') return null;
  if (typeof pages !== 'number' || !Number.isInteger(pages) || pages < 1) return null;
  return { text, fileName, pages };
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

  return json(stubResult(analyzeRequest), 200, cors);
}
